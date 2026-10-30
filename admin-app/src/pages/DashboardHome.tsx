import { Activity, ArrowUpLeft, CheckCircle2, Clock, FileHeart, Loader2, MoreHorizontal, Sparkles, UserRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { firebaseData } from '../lib/firebaseData';

const stats = [
  { label: 'طلاب طب الأسنان', key: 'students', icon: Activity, tone: 'purple' },
  { label: 'المرضى', key: 'patients', icon: UserRound, tone: 'teal' },
  { label: 'الحالات المنتظرة', key: 'pendingCases', icon: Clock, tone: 'orange' },
  { label: 'الحالات المعتمدة', key: 'approvedCases', icon: FileHeart, tone: 'blue' },
  { label: 'الحالات قيد المعالجة', key: 'inProgressCases', icon: Sparkles, tone: 'purple' },
  { label: 'الحالات المكتملة', key: 'completedCases', icon: CheckCircle2, tone: 'teal' },
] as const;

const colors = { patients: '#18ae88', students: '#517ff0', admins: '#f29a31', other: '#9367d8' };
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('ar-IQ', { month: 'long' }).format(new Date(2020, index, 1)));
const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

type ActivityRow = { id: string; title: string; status: string; tone: string; time: string };
type ProfileRow = { id: string; full_name?: string; role?: string; created_at?: string };
type CaseRow = { id: string; case_number?: string; status?: string; is_approved_for_student_view?: boolean; created_at?: string };
type MatchRow = { id: string; status?: string; created_at?: string };

const safeDate = (value?: string) => (value ? new Date(value).toLocaleDateString('ar-IQ') : 'غير متوفر');

export const DashboardHome = () => {
  const [year, setYear] = useState<string>('all');
  const [month, setMonth] = useState('all');
  const [counts, setCounts] = useState({
    students: 0,
    patients: 0,
    pendingCases: 0,
    approvedCases: 0,
    inProgressCases: 0,
    completedCases: 0,
    users: 0,
  });
  const [chart, setChart] = useState<{ name: string; cases: number; matches: number }[]>([]);
  const [pie, setPie] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentMatches, setRecentMatches] = useState<ActivityRow[]>([]);
  const [recentUsers, setRecentUsers] = useState<{ id: string; name: string; role: string; time: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (year === 'all') return null;
    const numericYear = Number(year);
    const start = month === 'all' ? new Date(numericYear, 0, 1) : new Date(numericYear, Number(month), 1);
    const end = month === 'all' ? new Date(numericYear + 1, 0, 1) : new Date(numericYear, Number(month) + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [year, month]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [profilesResult, casesResult, matchesResult] = await Promise.all([
        firebaseData.from('profiles').select('id,full_name,role,created_at').limit(500),
        firebaseData.from('patient_cases').select('id,case_number,status,is_approved_for_student_view,created_at').limit(500),
        firebaseData.from('matches').select('id,status,created_at').limit(500),
      ]);
      if (!active) return;
      const firstError = profilesResult.error || casesResult.error || matchesResult.error;
      if (firstError) {
        setError('تعذر تحميل لوحة التحكم من Firestore: ' + firstError.message);
        setLoading(false);
        return;
      }
      const inRange = (createdAt?: string) => {
        if (!range) return true;
        if (!createdAt) return false;
        return createdAt >= range.start && createdAt < range.end;
      };
      const profiles = ((profilesResult.data || []) as ProfileRow[]).filter((r) => inRange(r.created_at));
      const cases = ((casesResult.data || []) as CaseRow[]).filter((r) => inRange(r.created_at));
      const matches = ((matchesResult.data || []) as MatchRow[]).filter((r) => inRange(r.created_at));

      const students = profiles.filter((row) => row.role === 'STUDENT').length;
      const patients = profiles.filter((row) => row.role === 'PATIENT').length;
      const admins = profiles.filter((row) => ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(row.role || '')).length;

      const pendingCases = cases.filter(
        (row) =>
          row.status === 'PENDING' ||
          row.status === 'NEW' ||
          row.status === 'UNDER_REVIEW' ||
          (row.status === 'WAITING_FOR_MATCH' && row.is_approved_for_student_view === false),
      ).length;
      const approvedCases = cases.filter((row) => row.status === 'WAITING_FOR_MATCH' && row.is_approved_for_student_view !== false).length;
      const inProgressCases = cases.filter((row) => row.status === 'MATCHED' || row.status === 'IN_PROGRESS').length;
      const completedCases = cases.filter((row) => row.status === 'COMPLETED').length;

      setCounts({
        students,
        patients,
        pendingCases,
        approvedCases,
        inProgressCases,
        completedCases,
        users: profiles.length,
      });

      setPie([
        { name: 'مرضى', value: patients, color: colors.patients },
        { name: 'طلاب', value: students, color: colors.students },
        { name: 'إدارة', value: admins, color: colors.admins },
        { name: 'أخرى', value: Math.max(0, profiles.length - patients - students - admins), color: colors.other },
      ]);

      const buckets = (month === 'all' ? monthNames : [monthNames[Number(month)]]).map((name) => ({ name, cases: 0, matches: 0 }));
      const bucketIndex = (date?: string) => (month === 'all' ? new Date(date || '').getMonth() : 0);
      cases.forEach((row) => {
        const bucket = buckets[bucketIndex(row.created_at)];
        if (bucket) bucket.cases += 1;
      });
      matches.forEach((row) => {
        const bucket = buckets[bucketIndex(row.created_at)];
        if (bucket) bucket.matches += 1;
      });
      setChart(buckets);

      const sortedMatches = matches
        .slice()
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 5);
      setRecentMatches(
        sortedMatches.map((item) => ({
          id: item.id,
          title: `مطابقة ${item.id.slice(0, 8)}`,
          status: item.status || 'غير محددة',
          tone: item.status === 'COMPLETED' ? 'green' : item.status === 'CANCELLED' ? 'red' : 'blue',
          time: safeDate(item.created_at),
        })),
      );
      setRecentUsers(
        profiles
          .slice()
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            name: item.full_name || 'مستخدم بدون اسم',
            role: item.role === 'STUDENT' ? 'طالب طب أسنان' : item.role === 'PATIENT' ? 'مريض' : 'إدارة',
            time: safeDate(item.created_at),
            color: item.role === 'STUDENT' ? 'pink' : 'blue',
          })),
      );
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [range, month]);

  return (
    <AdminLayout>
      <div className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">بيانات حية من Firestore</span>
          <h1>لوحة التحكم</h1>
          <p>الأرقام والمخططات التالية تعرض البيانات الحقيقية مباشرة من Firestore.</p>
        </div>
        <div className="dashboard-filters">
          <label>
            السنة
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">كل السنوات</option>
              {years.map((item) => (
                <option key={item} value={String(item)}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            الشهر
            <select value={month} onChange={(event) => setMonth(event.target.value)} disabled={year === 'all'}>
              <option value="all">كل الأشهر</option>
              {monthNames.map((item, index) => (
                <option key={index} value={index}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {loading ? (
        <div className="empty-panel" role="status" aria-live="polite">
          <Loader2 className="animate-spin" /> جارٍ تحميل بيانات Firestore…
        </div>
      ) : error ? (
        <div className="admin-error">
          <strong>تعذر عرض البيانات</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="admin-stats">
            {stats.map(({ label, key, icon: Icon, tone }) => (
              <article className={`admin-stat ${tone}`} key={label}>
                <div className="stat-top">
                  <div className="stat-icon">
                    <Icon size={20} />
                  </div>
                  <MoreHorizontal size={18} />
                </div>
                <p>{label}</p>
                <strong>{counts[key].toLocaleString('ar-IQ')}</strong>
                <small>من سجلات Firestore الحقيقية</small>
              </article>
            ))}
          </div>
          <div className="dashboard-grid top-grid">
            <section className="admin-panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>إحصائيات الاستخدام</h2>
                  <p>الحالات والمطابقات حسب الأشهر</p>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-blue" /> الحالات
                </span>
                <span>
                  <i className="legend-teal" /> المطابقات
                </span>
              </div>
              <div className="chart-wrap" role="img" aria-label="مخطط الحالات والمطابقات للفترة المحددة">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#edf2f5" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9aaab5', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aaab5', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="cases" name="الحالات" fill="#4f84ee" radius={[6, 6, 0, 0]} barSize={12} />
                    <Bar dataKey="matches" name="المطابقات" fill="#1ab18e" radius={[6, 6, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="admin-panel users-pie">
              <div className="panel-heading">
                <div>
                  <h2>توزيع المستخدمين</h2>
                  <p>حسب نوع الحساب في المنصة</p>
                </div>
              </div>
              <div className="pie-content">
                <div className="pie-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pie} innerRadius={48} outerRadius={73} paddingAngle={2} dataKey="value" stroke="none">
                        {pie.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-center">
                    <strong>{counts.users.toLocaleString('ar-IQ')}</strong>
                    <small>مستخدم</small>
                  </div>
                </div>
                <div className="pie-legend">
                  {pie.map((item) => (
                    <div key={item.name}>
                      <i style={{ background: item.color }} />
                      <span>{item.name}</span>
                      <b>{item.value.toLocaleString('ar-IQ')}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
          <div className="dashboard-grid bottom-grid">
            <section className="admin-panel list-panel">
              <div className="panel-heading">
                <h2>أحدث المطابقات</h2>
                <Link to="/matches">
                  عرض الكل <ArrowUpLeft size={15} />
                </Link>
              </div>
              {recentMatches.length === 0 ? (
                <p className="empty-panel">لا توجد مطابقات مسجلة.</p>
              ) : (
                recentMatches.map((item) => (
                  <div className="activity-row" key={item.id}>
                    <div className={`case-thumb ${item.tone}`}>
                      <FileHeart size={18} />
                    </div>
                    <div>
                      <b>{item.title}</b>
                      <small>
                        {item.status} · {item.time}
                      </small>
                    </div>
                    <span className={`status ${item.tone}`}>{item.status}</span>
                  </div>
                ))
              )}
            </section>
            <section className="admin-panel list-panel">
              <div className="panel-heading">
                <h2>أحدث المستخدمين</h2>
                <Link to="/users">
                  عرض الكل <ArrowUpLeft size={15} />
                </Link>
              </div>
              {recentUsers.length === 0 ? (
                <p className="empty-panel">لا توجد حسابات مسجلة.</p>
              ) : (
                recentUsers.map((item) => (
                  <div className="activity-row" key={item.id}>
                    <div className={`user-photo ${item.color}`}>{item.name.charAt(0)}</div>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.role}</small>
                    </div>
                    <time>{item.time}</time>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  );
};
