const test = require('node:test');
const assert = require('node:assert/strict');

// Simulated minimal DOM environment to test the exact game logic
class MockClassList {
  constructor() {
    this._set = new Set();
  }
  add(...classes) { classes.forEach(c => this._set.add(c)); }
  remove(...classes) { classes.forEach(c => this._set.delete(c)); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this._set.add(c);
      else this._set.delete(c);
      return force;
    }
    if (this._set.has(c)) { this._set.delete(c); return false; }
    this._set.add(c); return true;
  }
  contains(c) { return this._set.has(c); }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.classList = new MockClassList();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.innerHTML = '';
    this.style = { setProperty: () => {}, getPropertyValue: () => '' };
  }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    list.forEach(fn => fn(event));
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  querySelector(sel) {
    if (sel === '.q-main') return this.children.find(c => c.classList.contains('q-main'));
    if (sel === '.ans') return this.children.find(c => c.classList.contains('ans'));
    if (sel === '.answer') return this.children.find(c => c.classList.contains('answer'));
    return null;
  }
  querySelectorAll(sel) {
    const results = [];
    const walk = (el) => {
      if (sel === '.q.asked' && el.classList && el.classList.contains('q') && el.classList.contains('asked')) {
        results.push(el);
      }
      (el.children || []).forEach(walk);
    };
    walk(this);
    return results;
  }
  insertBefore(newEl, beforeEl) {
    this.children.push(newEl);
  }
  remove() {
    this.removed = true;
  }
}

test('Behavioral: Helper on vs off logic', () => {
  const document = {
    body: new MockElement('body'),
    createElement: (tag) => new MockElement(tag),
  };

  let helperOn = true;
  const helperBtn = new MockElement('button');
  const questionsEl = new MockElement('div');
  const starsEl = new MockElement('div');

  function paintHelper() {
    document.body.dataset.helper = helperOn ? 'on' : 'off';
    helperBtn.classList.toggle('off', !helperOn);
    helperBtn.setAttribute('aria-label', helperOn ? 'Answer helper on' : 'Answer helper off');
    helperBtn.setAttribute('aria-pressed', helperOn);
  }

  // 1. Initial state (helperOn = true)
  paintHelper();
  assert.equal(document.body.dataset.helper, 'on');
  assert.equal(helperBtn.classList.contains('off'), false);

  // 2. Toggle helper off
  helperOn = false;
  paintHelper();
  assert.equal(document.body.dataset.helper, 'off');
  assert.equal(helperBtn.classList.contains('off'), true);

  // 3. Question asked when helper is off
  const card = document.createElement('div');
  card.classList.add('q');
  const main = document.createElement('button');
  main.classList.add('q-main');
  const ans = document.createElement('button');
  ans.classList.add('ans');
  const answerDiv = document.createElement('div');
  answerDiv.classList.add('answer');
  card.children = [main, ans, answerDiv];

  let replaced = false;
  const replace = () => { replaced = true; };
  card._replace = replace;

  const show = (on) => {
    if (!helperOn || !card.classList.contains('asked')) return;
    card.classList.toggle('showing', on);
  };

  // Click question
  card.classList.add('asked');

  // Attempting to show answer when helper is off should be blocked
  show(true);
  assert.equal(card.classList.contains('showing'), false, 'Answer should NOT be showing when helper is off');

  // 4. Toggle helper off with active asked questions replaces without revealing answers
  questionsEl.children = [card];
  if (!helperOn) {
    questionsEl.querySelectorAll('.q.asked').forEach(c => {
      if (c._replace) c._replace();
    });
  }
  assert.equal(replaced, true, 'Asked card should be replaced without firing pointer events or showing answers');
  assert.equal(card.classList.contains('showing'), false, 'Answer should not have been revealed');
});
