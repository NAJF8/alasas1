const IRAQI_PHONE = /^07\d{9}$/;

export const normalizeIraqiPhone = (value: string): string | null => {
  const digits = value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
      const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
      const index = arabicIndic.indexOf(digit);
      return String(index >= 0 ? index : easternArabicIndic.indexOf(digit));
    })
    .replace(/[\s()-]/g, '');
  if (/^009647\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^9647\d{9}$/.test(digits)) return `+${digits}`;
  if (IRAQI_PHONE.test(digits)) return `+964${digits.slice(1)}`;
  if (/^\+9647\d{9}$/.test(digits)) return digits;
  return null;
};

export const formatPhoneAuthError = (message: string) => {
  if (/rate|too many|429|sms/i.test(message)) return 'تعذر إرسال الرمز الآن. انتظر قليلاً ثم أعد المحاولة.';
  if (/expired|otp/i.test(message)) return 'رمز التحقق غير صالح أو انتهت صلاحيته. اطلب رمزاً جديداً.';
  if (/not found|does not exist|invalid login|user.*phone/i.test(message)) return 'تعذر إكمال التحقق. تحقق من البيانات أو سجّل حساباً جديداً.';
  if (/phone provider|sms/i.test(message)) return 'مزود الرسائل غير مفعّل حالياً في Supabase. لم يتم الادعاء بأن تسجيل الهاتف يعمل.';
  return message;
};
