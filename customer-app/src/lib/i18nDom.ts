import { enMore } from './i18nMore';
import { en } from './i18n';
import type { LangMode } from './theme';

// Runtime translator for text that is not wrapped in t() (inner pages, validation
// and server error messages, status labels). Arabic stays the source of truth:
// original text is remembered per node and restored when switching back to Arabic.

const exact = new Map<string, string>();
const patterns: Array<{ re: RegExp; out: string }> = [];

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const register = (source: Record<string, string>) => {
  for (const [ar, english] of Object.entries(source)) {
    if (/\{\d+\}/.test(ar)) {
      const re = new RegExp('^' + escapeRe(ar).replace(/\\\{(\d+)\\\}/g, '(.+?)') + '$', 's');
      patterns.push({ re, out: english.replace(/\{(\d+)\}/g, (_m, i) => '$' + (Number(i) + 1)) });
    } else {
      exact.set(ar, english);
    }
  }
};
register(en);
register(enMore);

const hasArabic = (value: string) => /[؀-ۿ]/.test(value);

export const translateCore = (core: string): string => {
  const hit = exact.get(core);
  if (hit !== undefined) return hit;
  for (const { re, out } of patterns) {
    if (re.test(core)) return core.replace(re, out);
  }
  return core;
};

// Keep leading/trailing whitespace (React splits "label: {value}" into separate nodes).
export const translateText = (value: string): string => {
  if (!hasArabic(value)) return value;
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match) return value;
  const translated = translateCore(match[2]);
  return translated === match[2] ? value : match[1] + translated + match[3];
};

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

const textState = new WeakMap<Text, { original: string; applied: string }>();
const attrState = new WeakMap<Element, Map<string, { original: string; applied: string }>>();

let observer: MutationObserver | null = null;
let active = false;

const applyText = (node: Text) => {
  const parent = node.parentElement;
  if (!parent || SKIP.has(parent.tagName)) return;
  const state = textState.get(node);
  const current = node.nodeValue ?? '';
  // If React rewrote the node since we translated it, treat the new value as the new original.
  const original = state && current === state.applied ? state.original : current;
  const translated = translateText(original);
  if (translated !== current) node.nodeValue = translated;
  if (translated !== original || state) textState.set(node, { original, applied: translated });
};

const applyAttrs = (element: Element) => {
  for (const name of ATTRS) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    let map = attrState.get(element);
    const state = map?.get(name);
    const original = state && current === state.applied ? state.original : current;
    const translated = translateText(original);
    if (translated !== current) element.setAttribute(name, translated);
    if (translated !== original || state) {
      if (!map) { map = new Map(); attrState.set(element, map); }
      map.set(name, { original, applied: translated });
    }
  }
};

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) { applyText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (SKIP.has(element.tagName)) return;
  applyAttrs(element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) applyText(node as Text);
    else if (!SKIP.has((node as Element).tagName)) applyAttrs(node as Element);
    node = walker.nextNode();
  }
};

const restore = (root: Node) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const state = textState.get(node as Text);
      if (state && node.nodeValue === state.applied) node.nodeValue = state.original;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const map = attrState.get(node as Element);
      map?.forEach((state, name) => {
        if ((node as Element).getAttribute(name) === state.applied) (node as Element).setAttribute(name, state.original);
      });
    }
    node = walker.nextNode();
  }
};

const run = (fn: () => void) => {
  observer?.disconnect();
  try { fn(); } finally {
    observer?.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  }
};

export const syncDomLanguage = (lang: LangMode) => {
  if (typeof document === 'undefined' || !document.body) return;
  if (lang === 'en') {
    if (!observer) {
      observer = new MutationObserver((records) => {
        run(() => {
          for (const record of records) {
            if (record.type === 'childList') record.addedNodes.forEach((added) => walk(added));
            else if (record.type === 'characterData') applyText(record.target as Text);
            else if (record.type === 'attributes') applyAttrs(record.target as Element);
          }
        });
      });
    }
    active = true;
    run(() => walk(document.body));
  } else if (active) {
    active = false;
    observer?.disconnect();
    restore(document.body);
  }
};
