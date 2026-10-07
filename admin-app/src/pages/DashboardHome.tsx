import { AdminLayout } from '../components/layout/AdminLayout';
import { Users, UserPlus, FileText, Activity } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const STATS = [
  { label: 'إجمالي المرضى', value: '1,240', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  { label: 'إجمالي الطلاب', value: '385', icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-100' },
  { label: 'الحالات بانتظار التطابق', value: '142', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-100' },
  { label: 'المطابقات الناجحة', value: '850', icon: Activity, color: 'text-green-600', bg: 'bg-green-100' },
];

const REVENUE_DATA = [
  { name: 'يناير', matches: 40, cases: 60 },
  { name: 'فبراير', matches: 55, cases: 80 },
  { name: 'مارس', matches: 70, cases: 100 },
  { name: 'أبريل', matches: 65, cases: 90 },
  { name: 'مايو', matches: 90, cases: 120 },
  { name: 'يونيو', matches: 110, cases: 150 },
];

export const DashboardHome = () => {
  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
        <p className="text-gray-500 mt-1">مرحباً بك في لوحة تحكم أسنان الأساس</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {STATS.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">الحالات والمطابقات شهرياً</h3>
          <div className="h-72 w-full" style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#6b7280' }} />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="cases" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الحالات" />
                <Bar dataKey="matches" fill="#10b981" radius={[4, 4, 0, 0]} name="المطابقات" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">أحدث المطابقات الذكية</h3>
            <button className="text-sm font-medium text-primary-600 hover:text-primary-700">عرض الكل</button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">تطابق جديد بنسبة 95%</p>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    حالة المريض #NJF-1025 مع طلب الطالب #REQ-544
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">منذ ساعتين</p>
                  <button className="text-xs font-medium text-primary-600 hover:text-primary-700 mt-2">مراجعة التطابق</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
