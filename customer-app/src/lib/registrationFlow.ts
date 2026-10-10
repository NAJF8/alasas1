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

const weakPasswords = new Set(['password', 'password1', 'password123', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'admin123', 'iloveyou', 'abc12345', '12345678', '123456789', '1234567890']);

export const REGISTRATION_PASSWORD_MAX_LENGTH = 128;

export const normalizeRegistrationPassword = (value: string) => value.normalize('NFKC').slice(0, REGISTRATION_PASSWORD_MAX_LENGTH);

export const isStrongRegistrationPassword = (value: string) => {
  const password = normalizeRegistrationPassword(value);
  if (password.length < 8 || password.length > REGISTRATION_PASSWORD_MAX_LENGTH) return false;
  const lower = password.toLowerCase();
  if (weakPasswords.has(lower) || /^([a-z0-9!@#$%^&*])\1+$/.test(lower)) return false;
  if (/^(?:01234567|12345678|23456789|34567890|98765432|87654321|76543210)$/.test(lower)) return false;
  return /[A-Za-z]/.test(password) && /[^A-Za-z]/.test(password);
};

export const registrationPasswordStrength = (value: string): 'ضعيفة' | 'متوسطة' | 'قوية' => {
  const password = normalizeRegistrationPassword(value);
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (!password || weakPasswords.has(password.toLowerCase())) return 'ضعيفة';
  return score >= 4 ? 'قوية' : score >= 2 ? 'متوسطة' : 'ضعيفة';
};
