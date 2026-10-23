import { Loader2, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { firebaseData } from '../../lib/firebaseData';
import { PublicMediaPicker } from './PublicMediaPicker';

type Category = { id: string; name_ar?: string; image_url?: string | null; image_media_id?: string | null; is_active?: boolean };
export const CategoryMediaPanel = ({ onError }: { onError: (message: string) => void }) => {
  const [rows, setRows] = useState<Category[]>([]); const [busy, setBusy] = useState(true);
  useEffect(() => { let active = true; void firebaseData.from('clinical_categories').select('id,name_ar,image_url,image_media_id,is_active').order('name_ar').then((result: any) => { if (!active) return; if (result.error) onError(result.error.message); else setRows(result.data || []); setBusy(false); }); return () => { active = false; }; }, [onError]);
  if (busy) return <div className="empty-panel"><Loader2 className="animate-spin" /> جارٍ تحميل التصنيفات…</div>;
  if (!rows.length) return <div className="settings-blocked"><Tag size={25} /><h3>لا توجد تصنيفات سريرية منشورة</h3><p>سيظهر اختيار الصورة هنا عندما تكون سجلات التصنيفات متاحة في Firestore.</p></div>;
  return <div className="settings-form-grid">{rows.map((row) => <PublicMediaPicker key={row.id} label={row.name_ar || 'تصنيف سريري'} sectionKey="clinical_categories" value={row.image_url} mediaId={row.image_media_id} target={{ collection: 'clinical_categories', document_id: row.id, field: 'image_url' }} onError={onError} onChange={(media) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, image_url: media?.public_url || null, image_media_id: media?.id || null } : item))} />)}</div>;
};
