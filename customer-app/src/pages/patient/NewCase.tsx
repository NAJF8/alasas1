import { Header } from '../../components/layout/Header';
import { PatientCaseWizard } from '../../components/patient/PatientCaseWizard';

export const NewCase = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">إضافة حالة جديدة</h1>
            <p className="mt-2 text-gray-500">أكمل الخطوات التالية لنتمكن من مطابقتك مع طالب طب الأسنان المناسب</p>
          </div>
          <PatientCaseWizard />
        </div>
      </main>
    </div>
  );
};
