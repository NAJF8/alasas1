const base = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
const email = `e2e-${Date.now()}@example.invalid`;
const password = 'Synthetic-E2E-Password-2026!';
const call = async (path, body) => {
  const response = await fetch(`${base}:${path}?key=fake-api-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed (${response.status})`);
  return payload;
};
const created = await call('signUp', { email, password, returnSecureToken: true });
const signedIn = await call('signInWithPassword', { email, password, returnSecureToken: true });
if (!created.localId || !signedIn.idToken || signedIn.email !== email) throw new Error('Auth emulator did not return the expected synthetic identity.');
console.log('AUTH_EMULATOR=PASS :: synthetic Email/Password account signed up and signed in; no Staging data was touched');
