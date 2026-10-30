import { Check, Loader2, Pencil, Plus, RefreshCw, Search, Tag, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseData } from '../../lib/firebaseData';
import { PublicMediaPicker } from './PublicMediaPicker';

type Category = {
  id: string;
  name_ar?: string;
  name_en?: string | null;
  code?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_media_id?: string | null;
  is_active?: boolean;
};

type CategoryForm = {
  name_ar: string;
  name_en: string;
  code: string;
  description: string;
  is_active: boolean;
  image_url: string | null;
  image_media_id: string | null;
};

const emptyCategory: CategoryForm = {
  name_ar: '',
  name_en: '',
  code: '',
  description: '',
  is_active: true,
  image_url: null,
  image_media_id: null,
};

const categorySelect = 'id,name_ar,name_en,code,description,image_url,image_media_id,is_active,created_at,updated_at';

export const CategoryMediaPanel = ({ onError }: { onError: (message: string) => void }) => {
  const [rows, setRows] = useState<Category[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyCategory);

  const load = useCallback(async () => {
    setBusy(true);
    const result = await firebaseData.from('clinical_categories').select(categorySelect).order('name_ar');
    if (result.error) onError(result.error.message);
    else setRows((result.data || []) as Category[]);
    setBusy(false);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => !query || `${r.name_ar || ''} ${r.name_en || ''} ${r.code || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    [rows, query],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyCategory);
    setMessage(null);
    setModalOpen(true);
  };

  const openEdit = (row: Category) => {
    setEditingId(row.id);
    setForm({
      name_ar: row.name_ar || '',
      name_en: row.name_en || '',
      code: row.code || '',
      description: row.description || '',
      is_active: row.is_active !== false,
      image_url: row.image_url || null,
      image_media_id: row.image_media_id || null,
    });
    setMessage(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingId(null);
    setForm(emptyCategory);
    setModalOpen(false);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name_ar.trim()) return;
    setSaving(true);
    setMessage(null);
    const payload: Record<string, unknown> = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || form.name_ar.trim(),
      code: form.code.trim() || `CAT_${Date.now().toString(36).toUpperCase()}`,
      description: form.description.trim() || null,
      is_active: form.is_active,
      image_url: form.image_url || null,
      image_media_id: form.image_media_id || null,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await firebaseData.from('clinical_categories').update(payload).eq('id', editingId).select(categorySelect).single()
      : await firebaseData.from('clinical_categories').insert(payload).select(categorySelect).single();
    if (result.error || !result.data) {
      onError(result.error?.message || 'تعذر حفظ التصنيف السريري.');
      setSaving(false);
      return;
    }
    const readback = await firebaseData.from('clinical_categories').select(categorySelect).eq('id', result.data.id).single();
    if (readback.error || !readback.data) {
      onError(readback.error?.message || 'تمت الكتابة لكن تعذر التحقق من قراءة التصنيف من Firestore.');
      setSaving(false);
      return;
    }
    setRows((current) =>
      editingId ? current.map((item) => (item.id === editingId ? (readback.data as Category) : item)) : [...current, readback.data as Category],
    );
    setMessage('تم حفظ التصنيف السريري والتحقق من قراءته من Firestore.');
    closeModal();
    setSaving(false);
  };

  const toggleActive = async (row: Category) => {
    setMessage(null);
    const nextActive = row.is_active === false;
    const result = await firebaseData
      .from('clinical_categories')
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select(categorySelect)
      .single();
    if (result.error || !result.data) {
      onError(result.error?.message || 'تعذر تحديث حالة نشر التصنيف.');
      return;
    }
    const readback = await firebaseData.from('clinical_categories').select(categorySelect).eq('id', row.id).single();
    if (readback.error || !readback.data) {
      onError(readback.error?.message || 'تعذر التحقق من قراءة حالة التصنيف.');
      return;
    }
    setRows((current) => current.map((item) => (item.id === row.id ? (readback.data as Category) : item)));
    setMessage(readback.data.is_active ? 'تم إظهار التصنيف السريري للجمهور.' : 'تم إخفاء التصنيف السريري مع الحفاظ على بياناته وصورته.');
  };

  if (busy) {
    return (
      <div className="empty-panel">
        <Loader2 className="animate-spin" /> جارٍ تحميل التصنيفات…
      </div>
    );
  }

  return (
    <div>
      <div className="management-toolbar" style={{ marginBottom: 16 }}>
        <div className="table-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في التصنيفات السريرية..." />
        </div>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={15} /> تحديث
        </button>
        <button type="button" className="dashboard-action" onClick={openNew}>
          <Plus size={15} /> تصنيف جديد
        </button>
      </div>

      {message && (
        <div className="settings-inline-success" style={{ marginBottom: 14 }}>
          <Check size={15} /> {message}
        </div>
      )}

      {!filtered.length ? (
        <div className="settings-blocked">
          <Tag size={25} />
          <h3>لا توجد تصنيفات سريرية مطابقة</h3>
          <p>يمكنك إضافة تصنيف جديد أو تعديل معايير البحث.</p>
        </div>
      ) : (
        <div className="settings-form-grid">
          {filtered.map((row) => (
            <div key={row.id} style={{ border: '1px solid #e2edf3', borderRadius: 14, padding: 12, background: '#fbfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div>
                  <b style={{ fontSize: 14 }}>{row.name_ar || 'تصنيف سريري'}</b>
                  {row.name_en && <small style={{ display: 'block', color: '#7a90a4', fontSize: 11 }}>{row.name_en}</small>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`status ${row.is_active !== false ? 'green' : 'red'}`}>
                    {row.is_active !== false ? 'منشور' : 'مخفي'}
                  </span>
                  <button type="button" className="row-action" onClick={() => openEdit(row)}>
                    <Pencil size={12} /> تعديل
                  </button>
                  <button type="button" className="row-action" onClick={() => void toggleActive(row)}>
                    {row.is_active !== false ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </div>
              <PublicMediaPicker
                label={row.name_ar || 'تصنيف سريري'}
                sectionKey="clinical_categories"
                value={row.image_url}
                mediaId={row.image_media_id}
                target={{ collection: 'clinical_categories', document_id: row.id, field: 'image_url' }}
                onError={onError}
                onChange={(media) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.id === row.id ? { ...item, image_url: media?.public_url || null, image_media_id: media?.id || null } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop">
          <form className="admin-modal" onSubmit={(e) => void saveCategory(e)}>
            <div className="panel-heading">
              <h2>{editingId ? 'تعديل تصنيف سريري' : 'إضافة تصنيف سريري'}</h2>
              <button type="button" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <label>
              اسم التصنيف بالعربية
              <input required value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </label>
            <label>
              الاسم بالإنجليزية (اختياري)
              <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </label>
            <label>
              الرمز (Code)
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: ENDO" />
            </label>
            <label>
              الوصف (اختياري)
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <PublicMediaPicker
              label="صورة التصنيف"
              sectionKey="clinical_categories"
              value={form.image_url}
              mediaId={form.image_media_id}
              target={editingId ? { collection: 'clinical_categories', document_id: editingId, field: 'image_url' } : undefined}
              onError={onError}
              onChange={(media) => setForm((current) => ({ ...current, image_url: media?.public_url || null, image_media_id: media?.id || null }))}
            />
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> منشور وظاهر في واجهة الزبون
            </label>
            <div className="modal-actions">
              <button type="button" onClick={closeModal}>
                إلغاء
              </button>
              <button className="dashboard-action" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} حفظ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
