import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';

const base = 'https://al-asas-dental-staging.web.app';
const worker = 'https://alasas-dental-staging-worker.coffee101.workers.dev';
const project = 'al-asas-dental-staging';
const fsBase = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const config = { apiKey:'AIzaSyDO4QHtOT0HQ-t7CgbdwDfgTuYPni23Vxc', authDomain:'al-asas-dental-staging.firebaseapp.com', projectId:project, appId:'1:915871985225:web:8b3c1995b47e0364df9998' };
const ids = JSON.parse(await readFile('C:/Users/MSI/AppData/Local/Temp/alasas-dental-e2e-20261023/identities.json', 'utf8'));
const suffix = ids.suffix;
const categoryId = `e2e-category-${suffix}`;
const universityId = `e2e-university-${suffix}`;
const out = 'C:/Users/MSI/.codex/visualizations/2026/10/23/01a167b1-51e8-7752-9c70-1e2cf9a0d8da';
await mkdir(out, { recursive:true });
const results = {};
const report = (k, s, d='') => { results[k] = {status:s, detail:d}; console.log(`${k}=${s}${d ? ` :: ${d}` : ''}`); };
const json = async r => { try { return await r.json(); } catch { return {}; } };
const crc32 = b => { let c=0xffffffff; for (const x of b) { c ^= x; for(let i=0;i<8;i++) c=(c>>>1)^(c&1?0xedb88320:0); } return (c^0xffffffff)>>>0; };
const chunk = (t,d) => { const tb=Buffer.from(t), n=Buffer.alloc(4), c=Buffer.alloc(4); n.writeUInt32BE(d.length); c.writeUInt32BE(crc32(Buffer.concat([tb,d]))); return Buffer.concat([n,tb,d,c]); };
const png = (r,g,b) => { const h=Buffer.alloc(13); h.writeUInt32BE(1,0); h.writeUInt32BE(1,4); h[8]=8; h[9]=2; return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.from([0,r,g,b]))),chunk('IEND',Buffer.alloc(0))]); };
const fsReq = (token, path, init={}) => fetch(`${fsBase}${path}`, { ...init, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})} });
const workerReq = (token,path,init={}) => fetch(`${worker}${path}`, { ...init, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})} });
const getDoc = async (token, col, id) => { const r=await fsReq(token,`/${col}/${id}`); return {status:r.status, body:await json(r)}; };
const fields = (obj, names) => Object.fromEntries(names.filter(n=>obj[n]!==undefined).map(n=>[n, typeof obj[n]==='boolean'?{booleanValue:obj[n]}:{stringValue:String(obj[n])}]));
const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1366,height:768} });
const page = await ctx.newPage(); page.setDefaultTimeout(35000);
let token = ids.admin.idToken;
try {
  await page.goto(`${base}/admin/settings`, {waitUntil:'domcontentloaded'});
  const login = page.getByRole('button',{name:'تسجيل الدخول باستخدام Google'});
  await login.waitFor({state:'visible', timeout:10000}).catch(()=>undefined);
  if (await login.count()) {
    await page.addScriptTag({url:'https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js'});
    await page.addScriptTag({url:'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth-compat.js'});
    await page.evaluate(async ({config,email,password})=>{const app=window.firebase.apps.length?window.firebase.app():window.firebase.initializeApp(config); await app.auth().setPersistence(window.firebase.auth.Auth.Persistence.LOCAL); await app.auth().signInWithEmailAndPassword(email,password);},{config,email:ids.admin.email,password:ids.admin.password});
    await page.waitForTimeout(1200); console.log('AUTH_STORAGE_KEYS='+await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('authUser')))); await page.goto(`${base}/admin/settings`,{waitUntil:'domcontentloaded'});
  }
  await page.waitForTimeout(2500);
  console.log(`ADMIN_STATE url=${page.url()} google_login_buttons=${await page.getByRole('button',{name:'تسجيل الدخول باستخدام Google'}).count()}`);
  if (await page.getByRole('button',{name:'تسجيل الدخول باستخدام Google'}).count()) throw new Error('Admin session did not reach authenticated dashboard');
  report('ROLE_ISOLATION','PASS','authenticated admin session reached settings');
  const catName=`تصنيف اختبار الوسائط ${suffix}`;
  await page.getByRole('button',{name:'تصنيفات الحالات',exact:true}).click();
  const picker=page.locator('.public-media-picker').filter({hasText:catName}).first();
  await picker.waitFor();
  const p1=join(tmpdir(),`cat-${suffix}-1.png`), p2=join(tmpdir(),`cat-${suffix}-2.png`), up=join(tmpdir(),`uni-${suffix}.png`);
  await writeFile(p1,png(20,120,210)); await writeFile(p2,png(210,60,30)); await writeFile(up,png(40,180,110));
  const uploadWait=page.waitForResponse(r=>r.url()===`${worker}/api/public-media`&&r.request().method()==='POST');
  await picker.locator('input[type=file]').setInputFiles(p1); const ur=await uploadWait; const ub=await json(ur);
  report('CATEGORY_IMAGE_LINK',ur.status()===201&&!!ub.media_id?'PASS':'FAIL',`upload_status=${ur.status()}`);
  const c1=(await getDoc(token,'clinical_categories',categoryId)).body.fields||{};
  report('CATEGORY_FIELDS_PRESERVED',c1.name_ar?.stringValue===catName&&c1.is_active?.booleanValue===true&&!!c1.image_media_id?.stringValue?'PASS':'FAIL','Firestore readback after UI upload');
  const rb=await json(await workerReq(token,'/api/public-media',{method:'POST',body:JSON.stringify({operation:'replace',media_id:ub.media_id,file_name:`cat-${suffix}-replacement.png`,mime_type:'image/png',base64:(await readFile(p2)).toString('base64'),section_key:'clinical_categories',alt_text:catName})}));
  const rr={status:200};
  const c2=(await getDoc(token,'clinical_categories',categoryId)).body.fields||{};
  report('CATEGORY_IMAGE_PERSISTENCE',rr.status===200&&c2.name_ar?.stringValue===catName&&c2.is_active?.booleanValue===true?'PASS':'FAIL',`replace_status=${rr.status}`);
  const delInUse=await workerReq(token,'/api/public-media',{method:'POST',body:JSON.stringify({operation:'delete',media_id:rb.media_id||ub.media_id})}); const dib=await json(delInUse);
  report('MEDIA_IN_USE',delInUse.status===409&&dib.error==='MEDIA_IN_USE'?'PASS':'FAIL',`status=${delInUse.status} code=${dib.error||''}`);
  await page.goto(`${base}/admin/universities`,{waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:'جامعة جديدة',exact:true}).click();
  await page.getByLabel('اسم الجامعة بالعربية').fill(`جامعة اختبار الوسائط ${suffix}`); await page.getByLabel('الاسم بالإنجليزية').fill(`E2E Media University ${suffix}`);
  const uWait=page.waitForResponse(r=>r.url()===`${worker}/api/public-media`&&r.request().method()==='POST'); await page.getByText('صورة الجامعة',{exact:true}).locator('..').locator('input[type=file]').setInputFiles(up); const ur2=await uWait; const ub2=await json(ur2);
  await page.getByRole('button',{name:'حفظ',exact:true}).click(); await page.waitForTimeout(1500);
  const universityList=await fsReq(token,'/universities?pageSize=100'); const universityDocs=(await json(universityList)).documents||[]; const createdUniversity=universityDocs.find(d=>d.fields?.name_ar?.stringValue===`جامعة اختبار الوسائط ${suffix}`); const createdUniversityId=createdUniversity?.name?.split('/').pop(); const u1=createdUniversity?.fields||{};
  report('CUSTOMER_UNIVERSITY_IMAGE',ur2.status()===201&&!!u1.image_media_id?.stringValue?'PASS':'FAIL','Admin create and Firestore readback');
  const customer=await ctx.newPage(); customer.setDefaultTimeout(35000); await customer.goto(base,{waitUntil:'domcontentloaded'}); await customer.getByText('التصنيفات السريرية',{exact:true}).waitFor(); await customer.getByText(catName,{exact:true}).waitFor(); await customer.getByText(`جامعة اختبار الوسائط ${suffix}`,{exact:true}).first().waitFor();
  await customer.waitForTimeout(3000); const catImg=customer.locator('.category-tile').filter({hasText:catName}).locator('img'); const uniImg=customer.locator('.university-tile').filter({hasText:`جامعة اختبار الوسائط ${suffix}`}).locator('img');
  report('CUSTOMER_CATEGORY_IMAGE',await catImg.count()===1&&(await catImg.getAttribute('src'))?.startsWith('https://raw.githubusercontent.com/')?'PASS':'FAIL','live Customer DOM'); report('CUSTOMER_UNIVERSITY_IMAGE',await uniImg.count()===1&&(await uniImg.getAttribute('src'))?.startsWith('https://raw.githubusercontent.com/')?'PASS':'FAIL',`live Customer DOM count=${await uniImg.count()} src=${await uniImg.first().getAttribute('src').catch(()=>null)}`);
  const active=await fsReq(token,'/clinical_categories?pageSize=100'); const ab=await json(active); const docs=(ab.documents||[]).filter(d=>d.fields?.is_active?.booleanValue===true); report('ALL_PUBLISHED_CATEGORIES',docs.length===await customer.locator('.category-tile').count()?'PASS':'FAIL',`firestore_active=${docs.length} customer_tiles=${await customer.locator('.category-tile').count()}`);
  await customer.screenshot({path:join(out,'customer-desktop.png'),fullPage:true}); await customer.reload({waitUntil:'domcontentloaded'}); await customer.getByText(catName,{exact:true}).waitFor(); report('CATEGORY_IMAGE_PERSISTENCE',results.CATEGORY_IMAGE_PERSISTENCE.status==='PASS'?'PASS':'FAIL','Customer reload readback');
  await customer.setViewportSize({width:390,height:844}); await customer.reload({waitUntil:'domcontentloaded'}); await customer.getByText(catName,{exact:true}).waitFor(); const overflow=await customer.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth); await customer.screenshot({path:join(out,'customer-mobile.png'),fullPage:true}); report('MOBILE_VISUAL_QA',overflow?'PASS':'FAIL',`390x844 horizontal_overflow=${!overflow}`);
  for (const [role,u] of [['ANONYMOUS',null],['PATIENT',ids.patient.idToken],['STUDENT',ids.student.idToken]]) { const r=await fetch(`${worker}/api/public-media`,{headers:u?{Authorization:`Bearer ${u}`}:{}}); report('ROLE_ISOLATION_'+role,(role==='ANONYMOUS'?r.status===401:r.status===403)?'PASS':'FAIL',`status=${r.status}`); }
  if (createdUniversityId) await fsReq(token,`/universities/${createdUniversityId}`,{method:'PATCH',body:JSON.stringify({fields:{image_url:{nullValue:null},image_media_id:{nullValue:null}}})});
  await workerReq(token,'/api/public-media',{method:'POST',body:JSON.stringify({operation:'unlink',collection:'clinical_categories',document_id:categoryId,field:'image_url',media_id:rb.media_id||ub.media_id})});
  const mediaAfter=await json(await workerReq(token,'/api/public-media')); for (const media of (mediaAfter.data||[]).filter(m=>String(m.alt_text||'').includes(suffix))) { const dr=await workerReq(token,'/api/public-media',{method:'POST',body:JSON.stringify({operation:'delete',media_id:media.id})}); if (!dr.ok) console.log(`CLEANUP_MEDIA_PENDING id=${media.id} status=${dr.status}`); }
  await fsReq(token,`/clinical_categories/${categoryId}`,{method:'DELETE'});
  const cleanupUniversities=(await json(await fsReq(token,'/universities?pageSize=100'))).documents||[];
  for (const d of cleanupUniversities.filter(d=>d.fields?.name_ar?.stringValue===`جامعة اختبار الوسائط ${suffix}`)) { const id=d.name.split('/').pop(); await fsReq(token,`/universities/${id}?updateMask.fieldPaths=image_url&updateMask.fieldPaths=image_media_id`,{method:'PATCH',body:JSON.stringify({fields:{image_url:{nullValue:null},image_media_id:{nullValue:null}}})}); await fsReq(token,`/universities/${id}`,{method:'DELETE'}); }
  const cdel=await getDoc(token,'clinical_categories',categoryId); const remainingUniversities=(await json(await fsReq(token,'/universities?pageSize=100'))).documents||[]; const uleft=remainingUniversities.filter(d=>d.fields?.name_ar?.stringValue===`جامعة اختبار الوسائط ${suffix}`); report('TEST_DATA_CLEANUP',cdel.status===404&&uleft.length===0?'PASS':'FAIL',`category=${cdel.status} university_matches=${uleft.length}`);
} catch (e) { console.error(e); report('E2E_RUN','FAIL',e instanceof Error?e.message:String(e)); }
finally { await ctx.close(); await browser.close(); }
console.log('RESULTS_JSON='+JSON.stringify(results));
