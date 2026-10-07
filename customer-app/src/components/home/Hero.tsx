import { Link } from 'react-router-dom';
import { Activity, Stethoscope, UserPlus } from 'lucide-react';

export const Hero = ({ accountAction }: { accountAction?: React.ReactNode }) => {
  return (
    <div className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32 pt-20 px-4 sm:px-6 lg:px-8">
          
          <main className="mt-10 mx-auto max-w-7xl sm:mt-12 md:mt-16 lg:mt-20 xl:mt-28">
            <div className="sm:text-center lg:text-right">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl leading-tight">
                <span className="block xl:inline">نربط المريض بالحالة المناسبة</span>{' '}
                <span className="block text-primary-600 xl:inline">والطالب بالمريض المناسب</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                حالتك قد تكون فرصة علاج لك ومتطلبًا لطالب أسنان. 
                المريض يرفع حالته مجانًا. الطالب يحدد الحالة التي يحتاجها. 
                النظام الذكي يساعد الإدارة على إيجاد أفضل تطابق.
              </p>
              <div className="mt-8 sm:flex sm:justify-center lg:justify-start gap-4">
                {accountAction || <>
                  <div className="rounded-md shadow">
                    <Link
                      to="/register/patient"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg transition-all"
                    >
                      <UserPlus className="ml-2 w-5 h-5" />
                      لدي حالة وأحتاج علاج
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0">
                    <Link
                      to="/register/student"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-primary-700 bg-primary-100 hover:bg-primary-200 md:py-4 md:text-lg transition-all"
                    >
                      <Stethoscope className="ml-2 w-5 h-5" />
                      أبحث عن حالة سريرية
                    </Link>
                  </div>
                </>}
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:left-0 lg:w-1/2 flex items-center justify-center bg-gray-50">
         {/* Placeholder for Hero Image */}
         <div className="p-12 w-full h-full flex items-center justify-center">
            <div className="w-full h-96 bg-primary-200 rounded-3xl shadow-xl flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjEiIGZpbGw9IiMwMDAiLz4KPC9zdmc+')]"></div>
               <Activity size={120} className="text-primary-500 opacity-50" />
            </div>
         </div>
      </div>
    </div>
  );
};
