export const displayValue = (value: unknown, key?: string) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'string' && key?.endsWith('_at')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ar-IQ');
  }
  return String(value);
};
