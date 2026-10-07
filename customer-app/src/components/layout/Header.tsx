import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

export const Header = () => {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-primary-500 text-white p-2 rounded-lg">
                <Activity size={24} />
              </div>
              <span className="text-2xl font-bold text-gray-900">أسنان الأساس</span>
            </Link>
          </div>

          {/* Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/how-it-works" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">كيف تعمل المنصة</Link>
            <Link to="/patients" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">للمرضى</Link>
            <Link to="/students" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">للطلاب والأطباء</Link>
            <Link to="/faq" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">الأسئلة الشائعة</Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block text-gray-600 hover:text-primary-600 font-medium px-4 py-2">
              تسجيل الدخول
            </Link>
            <Link to="/register" className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm">
              إنشاء حساب
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
