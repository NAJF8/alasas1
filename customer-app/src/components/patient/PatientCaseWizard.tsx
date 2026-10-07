import React, { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  'المعلومات الأساسية',
  'وصف المشكلة',
  'أعراض إضافية',
  'الصور',
  'التوفر',
  'مراجعة وإرسال'
];

export const PatientCaseWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    province: '',
    area: '',
    age: '',
    gender: '',
    description: '',
    symptoms: [] as string[],
    images: [] as File[],
    availableDays: [] as string[],
  });

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleSymptomToggle = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom) 
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send data to Supabase
    // Generate case ID
    alert('تم إرسال الحالة بنجاح! رقم الحالة: CASE-NJF-000123');
    navigate('/patient/dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {STEPS.map((step, index) => (
            <div key={index} className="flex flex-col items-center z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                index <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {index + 1}
              </div>
              <span className="text-xs mt-2 text-gray-500 hidden sm:block">{step}</span>
            </div>
          ))}
          {/* Connecting line */}
          <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 -z-10" style={{
             background: `linear-gradient(to left, #0d9488 ${(currentStep / (STEPS.length - 1)) * 100}%, #e5e7eb ${(currentStep / (STEPS.length - 1)) * 100}%)`
          }}></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <form onSubmit={currentStep === STEPS.length - 1 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
          
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-gray-900">المعلومات الأساسية</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المحافظة</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary-500 focus:border-primary-500"
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                    required
                  >
                    <option value="">اختر المحافظة</option>
                    <option value="نجف">النجف</option>
                    <option value="بغداد">بغداد</option>
                    {/* Add others */}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المنطقة</label>
                  <input 
                    type="text" 
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary-500 focus:border-primary-500"
                    value={formData.area}
                    onChange={(e) => setFormData({...formData, area: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">العمر</label>
                  <input 
                    type="number" 
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary-500 focus:border-primary-500"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الجنس</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary-500 focus:border-primary-500"
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    required
                  >
                    <option value="">اختر الجنس</option>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-gray-900">وصف المشكلة</h2>
              <p className="text-gray-500">اشرح لنا المشكلة التي تعاني منها بأسلوبك.</p>
              <div>
                <textarea 
                  className="w-full rounded-lg border-gray-300 border p-4 h-40 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="مثال: عندي ضرس مكسور، أحتاج تنظيف، عندي ألم عند الأكل..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                ></textarea>
              </div>
            </div>
          )}

          {/* Step 3: Symptoms */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-gray-900">أعراض إضافية</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['ألم', 'تورم', 'نزف', 'سن مكسور', 'حساسية', 'تسوس ظاهر', 'مشكلة باللثة', 'صعوبة بالأكل', 'لا أعرف'].map(symp => (
                  <label key={symp} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${formData.symptoms.includes(symp) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.symptoms.includes(symp)}
                      onChange={() => handleSymptomToggle(symp)}
                    />
                    <span className="font-medium">{symp}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Images */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-gray-900">الصور (اختياري ولكن مفضل)</h2>
              <p className="text-gray-500">الصور تساعد الطلاب على فهم حالتك بشكل أفضل ومطابقتها بسرعة.</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">اضغط هنا لرفع صور</p>
                <p className="text-sm text-gray-400">JPG, PNG, أو PDF للأشعة</p>
                <input type="file" multiple className="hidden" accept="image/*,.pdf" />
              </div>
              
              {/* Dummy warning */}
              <div className="bg-amber-50 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">يرجى محاولة تصوير السن أو المنطقة المتضررة بشكل واضح إن أمكن.</p>
              </div>
            </div>
          )}

          {/* Step 5: Availability */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-gray-900">التوفر</h2>
              <p className="text-gray-500">متى تكون متاحاً للحضور عادةً؟</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['صباحاً', 'ظهراً', 'مساءً'].map(day => (
                  <label key={day} className={`flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-colors ${formData.availableDays.includes(day) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.availableDays.includes(day)}
                      onChange={() => handleDayToggle(day)}
                    />
                    <span className="font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="text-center mb-8">
                <CheckCircle className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">مراجعة الطلب</h2>
                <p className="text-gray-500">يرجى التأكد من صحة المعلومات قبل الإرسال.</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500 block">المحافظة:</span> <span className="font-medium text-gray-900">{formData.province || '-'}</span></div>
                  <div><span className="text-gray-500 block">المنطقة:</span> <span className="font-medium text-gray-900">{formData.area || '-'}</span></div>
                  <div><span className="text-gray-500 block">العمر:</span> <span className="font-medium text-gray-900">{formData.age || '-'}</span></div>
                  <div><span className="text-gray-500 block">الجنس:</span> <span className="font-medium text-gray-900">{formData.gender || '-'}</span></div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <span className="text-gray-500 block text-sm mb-1">الوصف:</span>
                  <p className="font-medium text-gray-900">{formData.description || '-'}</p>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <span className="text-gray-500 block text-sm mb-1">الأعراض:</span>
                  <p className="font-medium text-gray-900">{formData.symptoms.length > 0 ? formData.symptoms.join('، ') : '-'}</p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                 <p className="text-sm text-blue-800 leading-relaxed">
                   <strong>ملاحظة هامة:</strong> سيتم استخدام هذه المعلومات لمطابقتك مع الطالب المناسب. الإدارة فقط من ستتواصل معك ولن يتم عرض رقم هاتفك لأي طالب.
                 </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
            {currentStep > 0 ? (
              <button 
                type="button" 
                onClick={prevStep}
                className="flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ChevronRight className="w-5 h-5 ml-2" />
                السابق
              </button>
            ) : (
              <div></div>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <button 
                type="submit"
                className="flex items-center px-8 py-3 border border-transparent shadow-sm text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                التالي
                <ChevronLeft className="w-5 h-5 mr-2" />
              </button>
            ) : (
              <button 
                type="submit"
                className="flex items-center px-8 py-3 border border-transparent shadow-sm text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                إرسال الحالة
                <CheckCircle className="w-5 h-5 mr-2" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
