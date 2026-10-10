export type RegistrationRole = 'PATIENT' | 'STUDENT';

export const REGISTRATION_ROLE_KEY = 'customer-app:registration-role';

export const isRegistrationRole = (value: string | null | undefined): value is RegistrationRole => value === 'PATIENT' || value === 'STUDENT';

export const readRegistrationRole = (): RegistrationRole | null => {
  try {
    const value = localStorage.getItem(REGISTRATION_ROLE_KEY);
    return isRegistrationRole(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeRegistrationRole = (role: RegistrationRole) => {
  try {
    localStorage.setItem(REGISTRATION_ROLE_KEY, role);
  } catch {
    // The URL still carries the role when storage is unavailable.
  }
};

export const normalizeArabicDigits = (value: string) => value.replace(/[٠-٩۰-۹]/g, (digit) => {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
  const index = arabicIndic.indexOf(digit);
  return String(index >= 0 ? index : easternArabicIndic.indexOf(digit));
});

const weakPins = new Set(['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '121212', '112233', '123123']);

export const isStrongRegistrationPin = (value: string) => {
  const pin = normalizeArabicDigits(value);
  if (!/^\d{6}$/.test(pin) || weakPins.has(pin)) return false;
  const digits = pin.split('').map(Number);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  return !ascending && !descending;
};
