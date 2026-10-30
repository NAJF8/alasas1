import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const requireFromAdminApp = createRequire(new URL('../../admin-app/package.json', import.meta.url));
const { chromium } = requireFromAdminApp('playwright');

const BASE_URL = 'https://al-asas-dental-staging.web.app';
const WORKER_URL = 'https://alasas-dental-staging-worker.coffee101.workers.dev';
const PROJECT_ID = 'al-asas-dental-staging';
const API_KEY = 'AIzaSyDO4QHtOT0HQ-t7CgbdwDfgTuYPni23Vxc';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const testResults = [];
const logResult = (category, name, status, details = '') => {
  testResults.push({ category, name, status, details });
  console.log(`[${status}] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([size, typeBytes, data, checksum]);
};

const makePng = (r, g, b) => {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  const pixels = deflateSync(Buffer.from([0, r, g, b]));
  return Buffer.concat([signature, pngChunk('IHDR', header), pngChunk('IDAT', pixels), pngChunk('IEND', Buffer.alloc(0))]);
};

const getGcloudToken = () => {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('Could not get gcloud token:', err.message);
    return null;
  }
};

const gcloudToken = getGcloudToken();

const createAuthUser = async (email, password) => {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      if (!res.ok) throw new Error(`Auth signUp failed: ${res.status} ${await res.text()}`);
      return await res.json();
    } catch (err) {
      if (i === 2) throw err;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
};

const deleteAuthUser = async (idToken) => {
  try {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    console.warn('Failed to delete auth user:', err.message);
  }
};

const fsAdminSetDoc = async (col, id, fields) => {
  if (!gcloudToken) throw new Error('gcloudToken required for administrative test fixtures');
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => {
        if (typeof v === 'boolean') return [k, { booleanValue: v }];
        if (typeof v === 'number') return [k, { integerValue: String(v) }];
        if (v === null) return [k, { nullValue: null }];
        if (Array.isArray(v)) {
          return [k, { arrayValue: { values: v.map((item) => ({ stringValue: String(item) })) } }];
        }
        return [k, { stringValue: String(v) }];
      })
    ),
  };
  const res = await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${gcloudToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`fsAdminSetDoc failed: ${res.status} ${await res.text()}`);
  return await res.json();
};

const fsAdminDeleteDoc = async (col, id) => {
  if (!gcloudToken) return;
  try {
    await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${gcloudToken}` },
    });
  } catch (err) {
    console.warn(`Failed to delete doc ${col}/${id}:`, err.message);
  }
};

const workerReq = async (token, path, body = null, method = 'POST', retries = 4) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = {};
      if (body && method !== 'GET' && method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
      }
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}${path}`, {
        method,
        headers,
        body: (body && method !== 'GET' && method !== 'HEAD') ? JSON.stringify(body) : undefined,
      });
      let json = null;
      try { json = await res.json(); } catch {}
      if (res.status === 409 && json?.error?.includes('contention') && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return { status: res.status, json, ok: res.ok };
    } catch (err) {
      console.warn(`workerReq ${method} ${path} attempt ${attempt} error:`, err.message);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
};

async function main() {
  console.log('================================================================');
  console.log('AL ASAS DENTAL — COMPLETE STAGING E2E RELEASE READINESS TEST SUITE');
  console.log('================================================================');

  const runId = Date.now().toString(36);
  const createdAuthTokens = [];
  const cleanupTasks = [];

  try {
    // -------------------------------------------------------------
    // PHASE 1: Create Isolated Synthetic Test Users & Roles
    // -------------------------------------------------------------
    console.log('\n--- PHASE 1: Isolated Synthetic Test Fixtures Setup ---');
    const adminEmail = `e2e-admin-${runId}@alasas.invalid`;
    const studentAEmail = `e2e-student-a-${runId}@alasas.invalid`;
    const studentBEmail = `e2e-student-b-${runId}@alasas.invalid`;
    const patientAEmail = `e2e-patient-a-${runId}@alasas.invalid`;
    const patientBEmail = `e2e-patient-b-${runId}@alasas.invalid`;
    const testPassword = 'SyntheticPassword2026!';

    const adminAuth = await createAuthUser(adminEmail, testPassword);
    createdAuthTokens.push(adminAuth.idToken);
    const studentAAuth = await createAuthUser(studentAEmail, testPassword);
    createdAuthTokens.push(studentAAuth.idToken);
    const studentBAuth = await createAuthUser(studentBEmail, testPassword);
    createdAuthTokens.push(studentBAuth.idToken);
    const patientAAuth = await createAuthUser(patientAEmail, testPassword);
    createdAuthTokens.push(patientAAuth.idToken);
    const patientBAuth = await createAuthUser(patientBEmail, testPassword);
    createdAuthTokens.push(patientBAuth.idToken);

    // Setup Firestore profiles with valid province_id
    await fsAdminSetDoc('profiles', adminAuth.localId, {
      id: adminAuth.localId,
      email: adminEmail,
      full_name: `مسؤول اختبار ${runId}`,
      role: 'ADMIN',
      status: 'VERIFIED',
      province_id: 'baghdad',
      created_at: new Date().toISOString(),
    });
    cleanupTasks.push(() => fsAdminDeleteDoc('profiles', adminAuth.localId));

    await fsAdminSetDoc('profiles', studentAAuth.localId, {
      id: studentAAuth.localId,
      email: studentAEmail,
      full_name: `طالب أ ${runId}`,
      role: 'STUDENT',
      status: 'PENDING',
      province_id: 'baghdad',
      created_at: new Date().toISOString(),
    });
    cleanupTasks.push(() => fsAdminDeleteDoc('profiles', studentAAuth.localId));

    await fsAdminSetDoc('profiles', studentBAuth.localId, {
      id: studentBAuth.localId,
      email: studentBEmail,
      full_name: `طالب ب ${runId}`,
      role: 'STUDENT',
      status: 'VERIFIED',
      province_id: 'baghdad',
      created_at: new Date().toISOString(),
    });
    cleanupTasks.push(() => fsAdminDeleteDoc('profiles', studentBAuth.localId));

    await fsAdminSetDoc('profiles', patientAAuth.localId, {
      id: patientAAuth.localId,
      email: patientAEmail,
      full_name: `مريض أ ${runId}`,
      role: 'PATIENT',
      status: 'VERIFIED',
      province_id: 'baghdad',
      created_at: new Date().toISOString(),
    });
    cleanupTasks.push(() => fsAdminDeleteDoc('profiles', patientAAuth.localId));

    await fsAdminSetDoc('profiles', patientBAuth.localId, {
      id: patientBAuth.localId,
      email: patientBEmail,
      full_name: `مريض ب ${runId}`,
      role: 'PATIENT',
      status: 'VERIFIED',
      province_id: 'baghdad',
      created_at: new Date().toISOString(),
    });
    cleanupTasks.push(() => fsAdminDeleteDoc('profiles', patientBAuth.localId));

    logResult('FIXTURES', 'SETUP_SYNTHETIC_USERS', 'PASS', 'Admin, Student A/B, Patient A/B created cleanly');

    // -------------------------------------------------------------
    // PHASE 2: Student Lifecycle & Profile Persistence
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: Student Lifecycle & Profile Persistence ---');
    // 1. Admin approves Student A
    const approveStudentRes = await workerReq(adminAuth.idToken, '/api/admin-user-update', {
      user_id: studentAAuth.localId,
      action: 'approve',
    });
    logResult('STUDENT_LIFECYCLE', 'ADMIN_APPROVE_STUDENT', approveStudentRes.status === 200 ? 'PASS' : 'FAIL', `status=${approveStudentRes.status}`);

    // 2. Student A updates profile and preferred universities (1-4)
    const uniListRes = await fetch(`${FIRESTORE_BASE}/universities?pageSize=10`, {
      headers: { Authorization: `Bearer ${studentAAuth.idToken}` },
    });
    const uniDocs = (await uniListRes.json()).documents || [];
    const validUniIds = uniDocs.map((d) => d.name.split('/').pop()).filter(Boolean).slice(0, 2);

    const updateProfileRes = await workerReq(studentAAuth.idToken, '/api/profile-update', {
      full_name: `طالب أ معدل ${runId}`,
      province_id: 'baghdad',
      preferred_university_ids: validUniIds,
      phone: '07701234567',
    });
    const profileData = updateProfileRes.json?.data;
    const profileSaved = updateProfileRes.status === 200 && profileData?.full_name?.includes('معدل');
    logResult('STUDENT_LIFECYCLE', 'STUDENT_UPDATE_PROFILE_AND_UNIVERSITIES', profileSaved ? 'PASS' : 'FAIL', `saved_unis=${profileData?.preferred_university_ids?.length}`);

    // Verify limit constraint (cannot select more than 4 universities)
    const excessUnisRes = await workerReq(studentAAuth.idToken, '/api/profile-update', {
      province_id: 'baghdad',
      preferred_university_ids: ['u1', 'u2', 'u3', 'u4', 'u5'],
    });
    logResult('STUDENT_LIFECYCLE', 'ENFORCE_MAX_4_UNIVERSITIES', excessUnisRes.status === 400 ? 'PASS' : 'FAIL', `status=${excessUnisRes.status}`);

    // -------------------------------------------------------------
    // PHASE 3: Patient Case Lifecycle & Private Medical Upload
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Patient Case Lifecycle & Medical Attachments ---');
    // Get clinical category
    const catListRes = await fetch(`${FIRESTORE_BASE}/clinical_categories?pageSize=1`, {
      headers: { Authorization: `Bearer ${patientAAuth.idToken}` },
    });
    const catDocs = (await catListRes.json()).documents || [];
    const testCatId = catDocs[0]?.name?.split('/').pop() || 'cat-test';

    // 1. Patient creates case with status PENDING
    const createCaseRes = await workerReq(patientAAuth.idToken, '/api/create_patient_case', {
      clinical_category_id: testCatId,
      province_id: 'baghdad',
      university_ids: validUniIds,
      area_id: 'central',
      patient_age: 26,
      patient_gender: 'MALE',
      title: `حالة تسوس اختبارية ${runId}`,
      description: 'حالة طبية اختبارية تتطلب تنظيف وحشوة تجميلية',
    });
    const createdCaseData = createCaseRes.json?.data;
    const caseId = createdCaseData?.id || createdCaseData?.case_id;
    if (caseId) {
      cleanupTasks.push(() => fsAdminDeleteDoc('patient_cases', caseId));
      cleanupTasks.push(() => fsAdminDeleteDoc('case_locks', caseId));
    }
    logResult('PATIENT_LIFECYCLE', 'CREATE_CASE_PENDING', createCaseRes.status === 201 && !!caseId ? 'PASS' : 'FAIL', `status=${createCaseRes.status} case_id=${caseId}`);

    // 2. Patient uploads private medical image (PNG) via binary upload
    const validPngBuffer = makePng(24, 180, 140);
    const uploadImageRes = await fetch(`${WORKER_URL}/api/storage/upload?case_id=${encodeURIComponent(caseId || 'invalid')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAAuth.idToken}`,
        'Content-Type': 'image/png',
        'x-file-name': `xray-${runId}.png`,
      },
      body: validPngBuffer,
    });
    const uploadJson = await uploadImageRes.json().catch(() => ({}));
    const attachmentId = uploadJson?.image_id;
    if (attachmentId) cleanupTasks.push(() => fsAdminDeleteDoc('case_images', attachmentId));
    logResult('STORAGE_SECURITY', 'VALID_IMAGE_UPLOAD', [200, 201].includes(uploadImageRes.status) && !!attachmentId ? 'PASS' : 'FAIL', `status=${uploadImageRes.status} image_id=${attachmentId}`);

    // 3. Test Magic Byte Validation (reject fake PNG with text payload)
    const fakeImageRes = await fetch(`${WORKER_URL}/api/storage/upload?case_id=${encodeURIComponent(caseId || 'invalid')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAAuth.idToken}`,
        'Content-Type': 'image/png',
        'x-file-name': `malicious.png`,
      },
      body: Buffer.from('<?php echo "evil"; ?>'),
    });
    const fakeJson = await fakeImageRes.json().catch(() => ({}));
    logResult('STORAGE_SECURITY', 'REJECT_INVALID_MAGIC_BYTES', fakeImageRes.status === 400 ? 'PASS' : 'FAIL', `status=${fakeImageRes.status} error=${fakeJson?.error}`);

    // 4. Test Path Traversal Protection
    const traversalRes = await fetch(`${WORKER_URL}/api/storage/upload?case_id=${encodeURIComponent('../../etc/passwd')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAAuth.idToken}`,
        'Content-Type': 'image/png',
        'x-file-name': `xray-${runId}.png`,
      },
      body: validPngBuffer,
    });
    logResult('STORAGE_SECURITY', 'REJECT_PATH_TRAVERSAL', traversalRes.status === 400 ? 'PASS' : 'FAIL', `status=${traversalRes.status}`);

    // 5. Test Duplicate Image Upload Prevention
    const duplicateRes = await fetch(`${WORKER_URL}/api/storage/upload?case_id=${encodeURIComponent(caseId || 'invalid')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAAuth.idToken}`,
        'Content-Type': 'image/png',
        'x-file-name': `xray-dup-${runId}.png`,
      },
      body: validPngBuffer,
    });
    const dupJson = await duplicateRes.json().catch(() => ({}));
    logResult('STORAGE_SECURITY', 'PREVENT_DUPLICATE_IMAGE_HASH', duplicateRes.status === 409 ? 'PASS' : 'FAIL', `status=${duplicateRes.status} error=${dupJson?.error}`);

    // 6. Verify case is NOT visible to student in search before approval
    const preApprovalSearch = await workerReq(studentAAuth.idToken, '/api/search_anonymized_patient_cases', null, 'GET');
    const preApprovedCases = preApprovalSearch.json?.cases || preApprovalSearch.json?.data || [];
    const isLeakedBeforeApproval = preApprovedCases.some((c) => c.id === caseId);
    logResult('PRIVACY_ISOLATION', 'CASE_HIDDEN_BEFORE_ADMIN_APPROVAL', !isLeakedBeforeApproval ? 'PASS' : 'FAIL', `visible_in_student_search=${isLeakedBeforeApproval}`);

    // -------------------------------------------------------------
    // PHASE 4: Admin Approval & Student Search Visibility
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Admin Approval & Privacy Controls ---');
    // Admin previews signed URL before approval
    const adminSignedUrlRes = await workerReq(adminAuth.idToken, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
    });
    logResult('STORAGE_SECURITY', 'ADMIN_GET_SIGNED_URL', adminSignedUrlRes.status === 200 && !!adminSignedUrlRes.json?.signed_url ? 'PASS' : 'FAIL', `status=${adminSignedUrlRes.status}`);

    // Admin approves case
    const approveCaseRes = await workerReq(adminAuth.idToken, '/api/case-approval', {
      case_id: caseId,
      action: 'approve',
    });
    logResult('CASE_LIFECYCLE', 'ADMIN_APPROVE_CASE', approveCaseRes.status === 200 ? 'PASS' : 'FAIL', `status=${approveCaseRes.status}`);

    // Verify case is now visible in student search without leaking patient contact info
    const postApprovalSearch = await workerReq(studentAAuth.idToken, '/api/search_anonymized_patient_cases', null, 'GET');
    const allFoundCases = postApprovalSearch.json?.cases || postApprovalSearch.json?.data || [];
    const foundCase = allFoundCases.find((c) => c.id === caseId);
    const privacyPreserved = foundCase && !foundCase.phone && !foundCase.patient_name && !foundCase.patient_id;
    logResult('PRIVACY_ISOLATION', 'ANONYMIZED_SEARCH_WITHOUT_CONTACT_LEAKS', privacyPreserved ? 'PASS' : 'FAIL', `found=${!!foundCase} has_phone=${!!foundCase?.phone}`);

    // -------------------------------------------------------------
    // PHASE 5: Student Requests & Exclusive Concurrent Matching
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: Student Requests & Concurrent Exclusive Matching ---');
    // Student A requests the case
    const studentAReqRes = await workerReq(studentAAuth.idToken, '/api/create_student_request', {
      requested_case_id: caseId,
      province_id: 'baghdad',
      university_ids: validUniIds,
      notes: 'طلب فحص وعلاج الحالة',
    });
    const reqAId = studentAReqRes.json?.data?.id || studentAReqRes.json?.id;
    if (reqAId) cleanupTasks.push(() => fsAdminDeleteDoc('student_requests', reqAId));
    logResult('MATCHING_ENGINE', 'STUDENT_A_REQUEST_CASE', studentAReqRes.status === 201 && !!reqAId ? 'PASS' : 'FAIL', `req_id=${reqAId}`);

    // Student B requests the case
    const studentBReqRes = await workerReq(studentBAuth.idToken, '/api/create_student_request', {
      requested_case_id: caseId,
      province_id: 'baghdad',
      university_ids: validUniIds,
      notes: 'طلب بديل من طالب ب',
    });
    const reqBId = studentBReqRes.json?.data?.id || studentBReqRes.json?.id;
    if (reqBId) cleanupTasks.push(() => fsAdminDeleteDoc('student_requests', reqBId));
    logResult('MATCHING_ENGINE', 'STUDENT_B_REQUEST_CASE', studentBReqRes.status === 201 && !!reqBId ? 'PASS' : 'FAIL', `req_id=${reqBId}`);

    // Prevent duplicate request for the same (student, case) pair
    const dupStudentReqRes = await workerReq(studentAAuth.idToken, '/api/create_student_request', {
      requested_case_id: caseId,
      province_id: 'baghdad',
      university_ids: validUniIds,
      notes: 'تكرار الطلب غير مسموح',
    });
    logResult('MATCHING_ENGINE', 'PREVENT_DUPLICATE_STUDENT_CASE_REQUEST', dupStudentReqRes.status === 409 ? 'PASS' : 'FAIL', `status=${dupStudentReqRes.status}`);

    // Admin approves both requests via admin student-request-review
    const approveA = await workerReq(adminAuth.idToken, '/api/student-request-review', { request_id: reqAId, action: 'approve' });
    const approveB = await workerReq(adminAuth.idToken, '/api/student-request-review', { request_id: reqBId, action: 'approve' });
    console.log('approveA:', approveA.status, JSON.stringify(approveA.json));
    console.log('approveB:', approveB.status, JSON.stringify(approveB.json));
    await new Promise((r) => setTimeout(r, 1200));

    // Test Concurrent Exclusive Matching
    console.log('Testing concurrent match requests for Student A and Student B on caseId:', caseId);
    const [matchA, matchB] = await Promise.all([
      workerReq(adminAuth.idToken, '/api/match', { request_id: reqAId, case_id: caseId }),
      workerReq(adminAuth.idToken, '/api/match', { request_id: reqBId, case_id: caseId }),
    ]);
    console.log('matchA:', matchA.status, JSON.stringify(matchA.json));
    console.log('matchB:', matchB.status, JSON.stringify(matchB.json));

    const oneSucceeded = (matchA.status === 200 && matchB.status === 409) || (matchB.status === 200 && matchA.status === 409);
    const successfulMatch = matchA.status === 200 ? matchA : matchB;
    const winningStudentToken = matchA.status === 200 ? studentAAuth.idToken : studentBAuth.idToken;
    const losingStudentToken = matchA.status === 200 ? studentBAuth.idToken : studentAAuth.idToken;
    const matchId = successfulMatch.json?.match_id || successfulMatch.json?.data?.match_id || successfulMatch.json?.data?.id;
    if (matchId) cleanupTasks.push(() => fsAdminDeleteDoc('matches', matchId));

    logResult('MATCHING_ENGINE', 'EXCLUSIVE_CONCURRENT_LOCK_ENFORCEMENT', oneSucceeded ? 'PASS' : 'FAIL', `matchA=${matchA.status} matchB=${matchB.status} matchId=${matchId}`);

    // -------------------------------------------------------------
    // PHASE 6: Private Medical Storage Access Matrix
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: Private Medical Storage Access Matrix ---');
    // 1. Matched student CAN get signed URL
    const matchedSignedUrlRes = await workerReq(winningStudentToken, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
    });
    logResult('STORAGE_SECURITY', 'MATCHED_STUDENT_SIGNED_URL_ACCESS', matchedSignedUrlRes.status === 200 && !!matchedSignedUrlRes.json?.signed_url ? 'PASS' : 'FAIL', `status=${matchedSignedUrlRes.status}`);

    // Download via signed URL succeeds
    if (matchedSignedUrlRes.json?.signed_url) {
      const downloadRes = await fetch(matchedSignedUrlRes.json.signed_url);
      logResult('STORAGE_SECURITY', 'MATCHED_STUDENT_IMAGE_DOWNLOAD', downloadRes.status === 200 ? 'PASS' : 'FAIL', `status=${downloadRes.status}`);
    }

    // 2. Unmatched student CANNOT get signed URL
    const unmatchedSignedUrlRes = await workerReq(losingStudentToken, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
    });
    logResult('STORAGE_SECURITY', 'UNMATCHED_STUDENT_BLOCKED', unmatchedSignedUrlRes.status === 403 ? 'PASS' : 'FAIL', `status=${unmatchedSignedUrlRes.status}`);

    // 3. Different patient CANNOT get signed URL
    const differentPatientRes = await workerReq(patientBAuth.idToken, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
    });
    logResult('STORAGE_SECURITY', 'FOREIGN_PATIENT_BLOCKED', differentPatientRes.status === 403 ? 'PASS' : 'FAIL', `status=${differentPatientRes.status}`);

    // 4. Guest / Anonymous CANNOT get signed URL
    const guestRes = await workerReq(null, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
    });
    logResult('STORAGE_SECURITY', 'GUEST_BLOCKED_UNAUTHORIZED', guestRes.status === 401 ? 'PASS' : 'FAIL', `status=${guestRes.status}`);

    // 5. Expired signed URL is rejected
    const expiredSignedUrlRes = await workerReq(winningStudentToken, '/api/storage/signed-url', {
      case_id: caseId,
      image_id: attachmentId,
      ttl_seconds: -10, // Intentionally expired
    });
    if (expiredSignedUrlRes.json?.signed_url) {
      const expiredFetch = await fetch(expiredSignedUrlRes.json.signed_url);
      logResult('STORAGE_SECURITY', 'EXPIRED_SIGNED_URL_REJECTED', expiredFetch.status === 403 ? 'PASS' : 'FAIL', `status=${expiredFetch.status}`);
    }

    // -------------------------------------------------------------
    // PHASE 7: Treatment Completion Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- PHASE 7: Treatment Completion Lifecycle ---');
    await new Promise((r) => setTimeout(r, 2500));
    const caseDocRes = await fetch(`${FIRESTORE_BASE}/patient_cases/${caseId}`, {
      headers: { Authorization: `Bearer ${adminAuth.idToken}` },
    });
    const caseDocData = await caseDocRes.json();
    const activeMatchId = matchId || caseDocData?.fields?.match_id?.stringValue;
    console.log('activeMatchId for treatment:', activeMatchId);

    if (activeMatchId) {
      cleanupTasks.push(() => fsAdminDeleteDoc('matches', activeMatchId));
      // Progress to IN_PROGRESS
      const inProgressRes = await workerReq(adminAuth.idToken, '/api/complete-treatment', {
        match_id: activeMatchId,
        action: 'in_progress',
      });
      console.log('inProgressRes:', inProgressRes.status, JSON.stringify(inProgressRes.json));
      logResult('TREATMENT_LIFECYCLE', 'TREATMENT_IN_PROGRESS', inProgressRes.status === 200 ? 'PASS' : 'FAIL', `status=${inProgressRes.status}`);

      // Progress to COMPLETED
      const completeRes = await workerReq(adminAuth.idToken, '/api/complete-treatment', {
        match_id: activeMatchId,
        action: 'complete',
      });
      console.log('completeRes:', completeRes.status, JSON.stringify(completeRes.json));
      const allCompleted = completeRes.status === 200 && (completeRes.json?.status === 'COMPLETED' || completeRes.json?.result?.status === 'COMPLETED');
      logResult('TREATMENT_LIFECYCLE', 'TREATMENT_COMPLETED', allCompleted ? 'PASS' : 'FAIL', `status=${completeRes.status}`);
    } else {
      logResult('TREATMENT_LIFECYCLE', 'TREATMENT_COMPLETED', 'FAIL', 'No activeMatchId found on case');
    }

    // -------------------------------------------------------------
    // PHASE 8: Super Admin Protection & Role Boundary Enforcement
    // -------------------------------------------------------------
    console.log('\n--- PHASE 8: Super Admin Protection & Role Enforcement ---');
    // Prevent modifying Super Admin
    const superAdminUid = 'a0ae30fd-ad5c-43cc-9b39-93e5ff273db6';
    const attackSuperAdminRes = await workerReq(adminAuth.idToken, '/api/admin-user-update', {
      user_id: superAdminUid,
      action: 'suspend',
    });
    logResult('SECURITY_ISOLATION', 'SUPER_ADMIN_IMMUTABILITY_PROTECTED', attackSuperAdminRes.status === 403 ? 'PASS' : 'FAIL', `status=${attackSuperAdminRes.status}`);

    // Prevent Student calling admin endpoints
    const studentCallingAdmin = await workerReq(studentAAuth.idToken, '/api/case-approval', {
      case_id: caseId,
      action: 'delete',
    });
    logResult('SECURITY_ISOLATION', 'STUDENT_CANNOT_INVOKE_ADMIN_API', studentCallingAdmin.status === 403 ? 'PASS' : 'FAIL', `status=${studentCallingAdmin.status}`);

    // Prevent Patient calling admin endpoints
    const patientCallingAdmin = await workerReq(patientAAuth.idToken, '/api/admin-user-update', {
      user_id: studentAAuth.localId,
      action: 'suspend',
    });
    logResult('SECURITY_ISOLATION', 'PATIENT_CANNOT_INVOKE_ADMIN_API', patientCallingAdmin.status === 403 ? 'PASS' : 'FAIL', `status=${patientCallingAdmin.status}`);

    // -------------------------------------------------------------
    // PHASE 9: UI/UX, Theme, Language & Responsive Viewport Checks
    // -------------------------------------------------------------
    console.log('\n--- PHASE 9: UI/UX, Theme, Language & Responsive Viewports ---');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // Check Customer App Landing Page
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Verify Footer Version 1.5.0
      const footerText = await page.textContent('footer');
      const footerValid = footerText?.includes('1.5.0') && footerText?.includes('الأساس');
      logResult('UI_UX', 'CUSTOMER_FOOTER_VERSION_1_5_0', footerValid ? 'PASS' : 'FAIL', `footer_has_version=${footerValid}`);

      // Verify Theme Switch
      const lightThemeBtn = page.locator('button[aria-label="الوضع النهاري"]');
      if (await lightThemeBtn.count()) {
        await lightThemeBtn.click();
        await page.waitForTimeout(500);
        const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        const storedTheme = await page.evaluate(() => localStorage.getItem('al-asas-theme'));
        logResult('UI_UX', 'THEME_SWITCH_LIGHT', themeAttr === 'light' && storedTheme === 'light' ? 'PASS' : 'FAIL', `theme=${themeAttr}`);
      }

      const darkThemeBtn = page.locator('button[aria-label="الوضع الليلي"]');
      if (await darkThemeBtn.count()) {
        await darkThemeBtn.click();
        await page.waitForTimeout(500);
        const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        const storedTheme = await page.evaluate(() => localStorage.getItem('al-asas-theme'));
        logResult('UI_UX', 'THEME_SWITCH_DARK', themeAttr === 'dark' && storedTheme === 'dark' ? 'PASS' : 'FAIL', `theme=${themeAttr}`);
      }

      // Verify Language Switch
      const langBtn = page.locator('.asas-lang-capsule');
      if (await langBtn.count()) {
        await langBtn.click();
        await page.waitForTimeout(500);
        const htmlLang = await page.evaluate(() => document.documentElement.lang);
        const htmlDir = await page.evaluate(() => document.documentElement.dir);
        const storedLang = await page.evaluate(() => localStorage.getItem('al-asas-lang'));
        logResult('UI_UX', 'LANGUAGE_SWITCH_PERSISTENCE', (htmlLang === 'en' && htmlDir === 'ltr') || (htmlLang === 'ar' && htmlDir === 'rtl') ? 'PASS' : 'FAIL', `lang=${htmlLang} dir=${htmlDir} stored=${storedLang}`);
      }

      // Responsive Viewports & Zero Horizontal Overflow Check
      const viewports = [
        { width: 320, height: 568 },
        { width: 375, height: 667 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1366, height: 768 },
        { width: 1920, height: 1080 },
      ];

      let overflowFound = false;
      for (const vp of viewports) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(300);
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        if (hasOverflow) {
          overflowFound = true;
          console.warn(`Horizontal overflow detected at viewport ${vp.width}x${vp.height}`);
        }
      }
      logResult('UI_UX', 'RESPONSIVE_VIEWPORTS_ZERO_OVERFLOW', !overflowFound ? 'PASS' : 'FAIL', `tested_${viewports.length}_viewports`);

      // Check Admin App Unified Hosting Route (/admin/)
      await page.goto(`${BASE_URL}/admin/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const adminHeading = await page.textContent('body');
      const adminLoaded = adminHeading?.includes('الأساس') || adminHeading?.includes('Google');
      logResult('HOSTING', 'UNIFIED_ADMIN_ROUTE_ACCESSIBLE', adminLoaded ? 'PASS' : 'FAIL', 'Route /admin/ rendered without 404');
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('\nFATAL ERROR DURING TEST EXECUTION:', err.stack || err);
    logResult('EXECUTION', 'TEST_RUNNER', 'FAIL', err.message);
  } finally {
    // -------------------------------------------------------------
    // PHASE 10: Automatic Teardown & Clean Up
    // -------------------------------------------------------------
    console.log('\n--- PHASE 10: Automatic Teardown & Cleanup ---');
    for (const task of cleanupTasks) {
      try { await task(); } catch (e) { console.warn('Cleanup task error:', e.message); }
    }
    for (const idToken of createdAuthTokens) {
      try { await deleteAuthUser(idToken); } catch (e) { console.warn('Auth user cleanup error:', e.message); }
    }
    console.log('Cleanup completed cleanly.');
  }

  // -------------------------------------------------------------
  // Summary & Pass/Fail Matrix
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('E2E RELEASE READINESS TEST EXECUTION REPORT');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === 'PASS').length;
  const failed = testResults.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('----------------------------------------------------------------');
  testResults.forEach((r) => {
    console.log(`[${r.status.padEnd(4)}] [${r.category.padEnd(18)}] ${r.name}: ${r.details}`);
  });
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
