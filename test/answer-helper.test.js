const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'index.html');

test('PWA root structure: all required assets exist at repository root', () => {
  const requiredFiles = [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'README.md',
    'icons/apple-touch-icon.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
  ];

  for (const rel of requiredFiles) {
    const fullPath = path.join(rootDir, rel);
    assert.ok(fs.existsSync(fullPath), `Expected ${rel} to exist at root`);
  }

  // Verify manifest can be parsed
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.short_name, 'Bag');

  // Verify sw.js references existing shell files
  const sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
  assert.match(sw, /const VERSION = "bag-v4"/);
});

test('CSS only shows .ans when helper setting is enabled', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');

  // Should NOT have unconditional .q.asked .ans { display: flex; } without [data-helper="on"] prefix
  assert.doesNotMatch(
    content,
    /^\s*\.q\.asked\s+\.ans\s*\{\s*display:\s*flex/m,
    'Should not unconditionally display .ans when .q is .asked'
  );

  // Should require helper to be enabled (e.g. body[data-helper="on"] .q.asked .ans)
  assert.match(
    content,
    /body\[data-helper=["']on["']\]\s+\.q\.asked\s+\.ans\s*\{\s*display:\s*flex/,
    'Should only display .ans when body[data-helper="on"]'
  );

  // Should explicitly ensure .ans is hidden when helper is not on
  assert.match(
    content,
    /body:not\(\[data-helper=["']on["']\]\)\s+\.ans\s*\{\s*display:\s*none\s*!important;\s*\}/,
    'Should explicitly hide .ans when helper is not on'
  );
});

test('paintHelper sets document.body.dataset.helper', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');

  assert.match(
    content,
    /document\.body\.dataset\.helper\s*=\s*helperOn\s*\?\s*["']on["']\s*:\s*["']off["']/,
    'paintHelper should set document.body.dataset.helper based on helperOn'
  );
});

test('helperBtn toggle does not dispatch pointerdown to reveal answers', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');

  // Old buggy behavior was dispatching pointerdown/up on .ans to advance questions
  assert.doesNotMatch(
    content,
    /dispatchEvent\(new PointerEvent\(["']pointerdown["']\)\)/,
    'Should not dispatch pointerdown to advance asked questions when helper is turned off'
  );
});

test('show function guards against showing answer when helper is off', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');

  // show() should verify helperOn before showing answer
  assert.match(
    content,
    /if\s*\(\s*!helperOn\s*\|\|\s*!card\.classList\.contains\(["']asked["']\)\s*\)\s*return/,
    'show() should check !helperOn'
  );
});

test('card exposes replace method for clean dismiss without showing answer', () => {
  const content = fs.readFileSync(htmlPath, 'utf8');

  assert.match(
    content,
    /card\._replace\s*=\s*replace/,
    'card should expose _replace method'
  );
});
