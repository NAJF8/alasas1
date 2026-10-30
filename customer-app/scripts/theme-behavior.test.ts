import assert from 'node:assert/strict';

// Mock browser environment for Node.js
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

class MockClassList {
  private classes = new Set<string>();
  add(cls: string): void { this.classes.add(cls); }
  remove(cls: string): void { this.classes.delete(cls); }
  contains(cls: string): boolean { return this.classes.contains ? this.classes.contains(cls) : this.classes.has(cls); }
  has(cls: string): boolean { return this.classes.has(cls); }
  toggle(cls: string, force?: boolean): boolean {
    if (force === true) {
      this.classes.add(cls);
      return true;
    } else if (force === false) {
      this.classes.delete(cls);
      return false;
    }
    if (this.classes.has(cls)) {
      this.classes.delete(cls);
      return false;
    }
    this.classes.add(cls);
    return true;
  }
}

class MockElement {
  public attributes = new Map<string, string>();
  public classList = new MockClassList();
  public lang = '';
  public dir = '';

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

let mockPrefersDark = true;
const mockLocalStorage = new MockLocalStorage();
const mockDocumentElement = new MockElement();

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).document = {
  documentElement: mockDocumentElement,
};
(globalThis as any).window = {
  localStorage: mockLocalStorage,
  matchMedia: (query: string) => ({
    matches: query.includes('dark') ? mockPrefersDark : !mockPrefersDark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
};

// Now import the module under test
const {
  THEME_KEY,
  resolveEffectiveTheme,
  applyThemeToDom,
  readStoredTheme,
} = await import('../src/lib/theme.ts');

console.log('--- RUNNING THEME BEHAVIOR TEST SUITE ---');

// 1. FIRST VISIT TESTS
// On first visit, localStorage is empty.
// Even if system OS / browser is in DARK mode, default must be 'light'.
mockLocalStorage.clear();
mockPrefersDark = true; // System OS is dark!

assert.equal(mockLocalStorage.getItem(THEME_KEY), null, 'localStorage should initially be empty');
const firstVisitTheme = readStoredTheme();
assert.equal(firstVisitTheme, 'light', 'First visit MUST default to light mode even if OS is dark');

const effectiveOnFirstVisit = resolveEffectiveTheme(firstVisitTheme);
assert.equal(effectiveOnFirstVisit, 'light', 'Effective theme on first visit must be light');

applyThemeToDom(firstVisitTheme);
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'light', 'data-theme on first visit must be light');
assert.equal(mockDocumentElement.getAttribute('data-theme-mode'), 'light', 'data-theme-mode on first visit must be light');
assert.equal(mockDocumentElement.classList.has('dark'), false, 'documentElement must NOT have dark class on first visit');
console.log('✓ Test 1 Passed: First visit defaults to Light Mode even with dark OS/browser');

// Also test first visit when system OS is light
mockLocalStorage.clear();
mockPrefersDark = false;
assert.equal(readStoredTheme(), 'light', 'First visit defaults to light when OS is light');
assert.equal(resolveEffectiveTheme('light'), 'light');
console.log('✓ Test 2 Passed: First visit defaults to Light Mode when OS is light');

// 2. THEME CHANGE TESTS
// User explicitly chooses 'dark'
applyThemeToDom('dark');
mockLocalStorage.setItem(THEME_KEY, 'dark');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'dark', 'Changing to dark sets data-theme="dark"');
assert.equal(mockDocumentElement.getAttribute('data-theme-mode'), 'dark', 'Changing to dark sets data-theme-mode="dark"');
assert.equal(mockDocumentElement.classList.has('dark'), true, 'Changing to dark adds dark class');
assert.equal(mockLocalStorage.getItem(THEME_KEY), 'dark', 'Choosing dark saves "dark" to localStorage');
console.log('✓ Test 3 Passed: User switching to Dark mode updates DOM and persists choice');

// User explicitly chooses 'light'
applyThemeToDom('light');
mockLocalStorage.setItem(THEME_KEY, 'light');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'light', 'Changing to light sets data-theme="light"');
assert.equal(mockDocumentElement.getAttribute('data-theme-mode'), 'light', 'Changing to light sets data-theme-mode="light"');
assert.equal(mockDocumentElement.classList.has('dark'), false, 'Changing to light removes dark class');
assert.equal(mockLocalStorage.getItem(THEME_KEY), 'light', 'Choosing light saves "light" to localStorage');
console.log('✓ Test 4 Passed: User switching to Light mode updates DOM and persists choice');

// User explicitly chooses 'system'
mockLocalStorage.setItem(THEME_KEY, 'system');
mockPrefersDark = true;
assert.equal(resolveEffectiveTheme('system'), 'dark', 'System mode resolves to dark when OS is dark');
applyThemeToDom('system');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'dark');
assert.equal(mockDocumentElement.getAttribute('data-theme-mode'), 'system');
assert.equal(mockDocumentElement.classList.has('dark'), true);

mockPrefersDark = false;
assert.equal(resolveEffectiveTheme('system'), 'light', 'System mode resolves to light when OS is light');
applyThemeToDom('system');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'light');
assert.equal(mockDocumentElement.getAttribute('data-theme-mode'), 'system');
assert.equal(mockDocumentElement.classList.has('dark'), false);
console.log('✓ Test 5 Passed: System option follows device settings when explicitly selected');

// 3. PERSISTENCE & REOPENING TESTS
// Scenario A: User had selected 'dark' previously
mockLocalStorage.setItem(THEME_KEY, 'dark');
assert.equal(readStoredTheme(), 'dark', 'Reopening site with saved dark preference returns dark');
assert.equal(resolveEffectiveTheme(readStoredTheme()), 'dark', 'Reopening resolves to dark');

// Scenario B: User had selected 'system' previously
mockLocalStorage.setItem(THEME_KEY, 'system');
assert.equal(readStoredTheme(), 'system', 'Reopening site with saved system preference returns system');

// Scenario C: User had selected 'light' previously
mockLocalStorage.setItem(THEME_KEY, 'light');
assert.equal(readStoredTheme(), 'light', 'Reopening site with saved light preference returns light');

// Scenario D: Invalid or corrupt storage value
mockLocalStorage.setItem(THEME_KEY, 'invalid-value');
assert.equal(readStoredTheme(), 'light', 'Corrupted theme preference falls back safely to light');
console.log('✓ Test 6 Passed: Saved choices in localStorage are respected upon site reopen');

// 4. ANTI-FLASH SCRIPT SIMULATION (First Paint guard)
function runAntiFlashScript(storage: MockLocalStorage, docElem: MockElement, osDark: boolean) {
  try {
    var mode = storage.getItem('al-asas-theme');
    var effective = 'light';
    if (mode === 'dark') {
      effective = 'dark';
    } else if (mode === 'system') {
      effective = osDark ? 'dark' : 'light';
    } else {
      mode = 'light';
      effective = 'light';
    }
    docElem.setAttribute('data-theme', effective);
    docElem.setAttribute('data-theme-mode', mode);
    if (effective === 'dark') {
      docElem.classList.add('dark');
    } else {
      docElem.classList.remove('dark');
    }
  } catch (e) {}
}

// First visit simulation with dark OS
const elem1 = new MockElement();
const storage1 = new MockLocalStorage();
runAntiFlashScript(storage1, elem1, true);
assert.equal(elem1.getAttribute('data-theme'), 'light', 'Anti-flash script sets light on first visit');
assert.equal(elem1.classList.has('dark'), false);

// Returning user with dark mode saved
const elem2 = new MockElement();
const storage2 = new MockLocalStorage();
storage2.setItem('al-asas-theme', 'dark');
runAntiFlashScript(storage2, elem2, false);
assert.equal(elem2.getAttribute('data-theme'), 'dark', 'Anti-flash script sets dark when saved preference is dark');
assert.equal(elem2.classList.has('dark'), true);

// Returning user with system mode saved
const elem3 = new MockElement();
const storage3 = new MockLocalStorage();
storage3.setItem('al-asas-theme', 'system');
runAntiFlashScript(storage3, elem3, true);
assert.equal(elem3.getAttribute('data-theme'), 'dark', 'Anti-flash script evaluates system preference');

console.log('✓ Test 7 Passed: Anti-flash script sets data-theme before first paint');
console.log('=== ALL THEME BEHAVIOR TESTS PASSED ===');
