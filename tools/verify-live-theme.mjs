const urls = [
  'https://dental.alasas.tech',
  'https://dental.alasas.tech/admin',
  'https://al-asas-dental-prod.web.app',
  'https://al-asas-dental-prod.web.app/admin'
];

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    const text = await res.text();
    const hasScript = text.includes('al-asas-theme');
    const hasLangAr = text.includes('lang="ar"');
    const hasDirRtl = text.includes('dir="rtl"');
    console.log(`URL: ${url}`);
    console.log(`  Status: ${res.status}`);
    console.log(`  hasAntiFlashScript: ${hasScript}`);
    console.log(`  hasLangAr: ${hasLangAr}`);
    console.log(`  hasDirRtl: ${hasDirRtl}`);
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
  }
}
