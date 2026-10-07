import { Header } from '../../components/layout/Header';
import { Search, MapPin, Activity, CheckCircle, User, Filter } from 'lucide-react';

const DUMMY_CASES = [
  {
    id: 'NJF-1024',
    province: 'النجف',
    age: 29,
    gender: 'ذكر',
    symptoms: ['ألم', 'سن مكسور'],
    description: 'لدي ضرس خلفي مكسور وأشعر بالألم عند الأكل.',
    imagesCount: 3,
    aiMatch: 89,
    tags: ['Posterior Tooth', 'Pain', 'Broken Tooth']
  },
  {
    id: 'BGD-842',
    province: 'بغداد',
    age: 45,
    gender: 'أنثى',
    symptoms: ['مشكلة باللثة', 'نزف'],
    description: 'أعاني من نزيف في اللثة عند تفريش الأسنان ورائحة فم.',
    imagesCount: 1,
    aiMatch: 75,
    tags: ['Periodontal', 'Bleeding']
  }
];

export const SearchCases = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">البحث عن الحالات</h1>
              <p className="mt-2 text-gray-500">تصفح الحالات المتوفرة والتي تتطابق مع متطلباتك السريرية</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="ابحث عن حالة..." 
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button className="bg-white border border-gray-300 p-2.5 rounded-lg text-gray-600 hover:bg-gray-50">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DUMMY_CASES.map(patientCase => (
              <div key={patientCase.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      رقم الحالة: {patientCase.id}
                    </span>
                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg text-sm font-bold">
                      <CheckCircle className="w-4 h-4" />
                      {patientCase.aiMatch}% تطابق
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {patientCase.province}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4 text-gray-400" />
                      {patientCase.age} سنة - {patientCase.gender}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">الوصف المختصر:</h4>
                    <p className="text-gray-600 text-sm line-clamp-2">"{patientCase.description}"</p>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">الأعراض والتصنيف:</h4>
                    <div className="flex flex-wrap gap-2">
                      {patientCase.symptoms.map(symp => (
                        <span key={symp} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {symp}
                        </span>
                      ))}
                      {patientCase.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-50 text-primary-700">
                          <Activity className="w-3 h-3 ml-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4 flex gap-3">
                    <button className="flex-1 bg-white border border-primary-600 text-primary-600 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors">
                      التفاصيل
                    </button>
                    <button className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors" onClick={() => alert('تم إرسال طلبك للإدارة')}>
                      طلب الحالة
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
};
