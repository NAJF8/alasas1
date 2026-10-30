import assert from 'node:assert/strict';

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

const {
  THEME_KEY,
  resolveEffectiveTheme,
  applyTheme,
  readTheme,
} = await import('../src/lib/theme.ts');

console.log('--- RUNNING ADMIN THEME BEHAVIOR TEST SUITE ---');

// 1. First visit test
mockLocalStorage.clear();
mockPrefersDark = true;
assert.equal(readTheme(), 'light', 'Admin first visit defaults to light mode');
assert.equal(resolveEffectiveTheme('light'), 'light');
applyTheme('light');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'light');
assert.equal(mockDocumentElement.classList.has('dark'), false);
console.log('✓ Admin Test 1 Passed: First visit defaults to Light Mode');

// 2. Change to dark
applyTheme('dark');
mockLocalStorage.setItem(THEME_KEY, 'dark');
assert.equal(mockDocumentElement.getAttribute('data-theme'), 'dark');
assert.equal(mockDocumentElement.classList.has('dark'), true);
console.log('✓ Admin Test 2 Passed: Dark mode updates DOM and persists');

// 3. System mode explicitly chosen
mockLocalStorage.setItem(THEME_KEY, 'system');
mockPrefersDark = true;
assert.equal(resolveEffectiveTheme('system'), 'dark');
mockPrefersDark = false;
assert.equal(resolveEffectiveTheme('system'), 'light');
console.log('✓ Admin Test 3 Passed: System mode explicitly follows OS preference');

// 4. Persistence on reopen
mockLocalStorage.setItem(THEME_KEY, 'dark');
assert.equal(readTheme(), 'dark');
mockLocalStorage.setItem(THEME_KEY, 'light');
assert.equal(readTheme(), 'light');
mockLocalStorage.setItem(THEME_KEY, 'system');
assert.equal(readTheme(), 'system');
console.log('✓ Admin Test 4 Passed: Saved theme preference persists');

console.log('=== ALL ADMIN THEME BEHAVIOR TESTS PASSED ===');
