import { Header } from '../components/layout/Header';
import { Hero } from '../components/home/Hero';

export const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow">
        <Hero />
        
        {/* Features Section Outline */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                كيف تعمل المنصة؟
              </h2>
              <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
                نظام ذكي وآمن يضمن الخصوصية وسرعة المطابقة بين الطرفين.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">1</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">سجل حالتك</h3>
                <p className="text-gray-600">المريض يرفع تفاصيل حالته وصور الأسنان بسهولة وبشكل مجاني تماماً.</p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">2</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">المطابقة الذكية</h3>
                <p className="text-gray-600">يقوم الذكاء الاصطناعي بمطابقة الحالة مع الطلاب الذين يبحثون عن نفس المشكلة.</p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">3</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">التواصل والتنسيق</h3>
                <p className="text-gray-600">تقوم إدارة المنصة بالتواصل مع الطرفين وتحديد موعد العلاج بكل سرية.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>© {new Date().getFullYear()} أسنان الأساس. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
};
