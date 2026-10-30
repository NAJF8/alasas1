export const calculateAge = (birthDate: string, today = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
};
