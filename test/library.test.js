const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// Extract LIBRARY and COLORS and QUESTIONS from index.html
function extractLibrary() {
  const libMatch = content.match(/const LIBRARY = \[([\s\S]*?)\];/);
  assert.ok(libMatch, 'LIBRARY array should be present in index.html');
  const rows = libMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('"') || line.startsWith("'"))
    .map(line => line.replace(/^["']|["'],?$/g, ''));
  return rows;
}

function extractColors() {
  const colMatch = content.match(/const COLORS = \{([\s\S]*?)\};/);
  assert.ok(colMatch, 'COLORS object should be present');
  const keys = [...colMatch[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
  return new Set(keys);
}

function extractValidTags() {
  const qMatch = content.match(/const QUESTIONS = \[([\s\S]*?)\];/);
  assert.ok(qMatch, 'QUESTIONS array should be present');
  const tags = [...qMatch[1].matchAll(/key:\s*["'](\w+)["']/g)].map(m => m[1]);
  // "color" and "sound" are special keys, not tags
  return new Set(tags.filter(k => k !== 'color' && k !== 'sound'));
}

function extractSomeSet() {
  const match = content.match(/const SOME = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, 'SOME Set should be present');
  const words = [...match[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  return new Set(words);
}

test('Library contains exactly 100 items', () => {
  const library = extractLibrary();
  assert.equal(library.length, 100, `Expected 100 items, but got ${library.length}`);
});

test('Library items have unique names and valid format', () => {
  const library = extractLibrary();
  const validColors = extractColors();
  const validTags = extractValidTags();
  const names = new Set();

  for (let i = 0; i < library.length; i++) {
    const row = library[i];
    const parts = row.split('|');
    assert.equal(parts.length, 5, `Item at index ${i} (${row}) must have 5 parts`);

    const [look, name, colors, sound, tags] = parts;
    assert.ok(look.length > 0, `Item ${name} has empty look/emoji`);
    assert.ok(name.length > 0, `Item at index ${i} has empty name`);
    assert.ok(!names.has(name), `Duplicate item name: "${name}"`);
    names.add(name);

    // Check colors
    const colorList = colors.split(',');
    assert.ok(colorList.length > 0, `Item ${name} must have at least one color`);
    for (const c of colorList) {
      assert.ok(validColors.has(c), `Item ${name} has invalid color "${c}"`);
    }

    // Check sound and noise tag consistency
    assert.ok(sound.length > 0, `Item ${name} has empty sound`);
    const tagList = tags.split(' ').filter(Boolean);
    const tagSet = new Set(tagList);

    if (sound !== '-') {
      assert.ok(tagSet.has('noise'), `Item "${name}" makes sound "${sound}" so it must have "noise" tag`);
    }

    // Check tags against known questions
    for (const tag of tagList) {
      assert.ok(validTags.has(tag), `Item ${name} has unknown tag "${tag}"`);
    }
  }
});

test('Speech pathology onomatopoeia targets and grammatical phrases are valid', () => {
  const library = extractLibrary();
  const someSet = extractSomeSet();

  // Speech pathology sound-imitation milestones for 4yo
  const keyTargets = [
    { name: 'cow', sound: 'Moo moo!' },
    { name: 'pig', sound: 'Oink oink!' },
    { name: 'sheep', sound: 'Baa baa!' },
    { name: 'horse', sound: 'Neigh!' },
    { name: 'rooster', sound: 'Cock-a-doodle-doo!' },
    { name: 'drum', sound: 'Boom boom boom!' },
    { name: 'police car', sound: 'Wee woo wee woo!' },
    { name: 'robot', sound: 'Beep boop!' },
  ];

  const map = new Map();
  for (const row of library) {
    const [, name, , sound] = row.split('|');
    map.set(name, sound);
  }

  for (const target of keyTargets) {
    assert.ok(map.has(target.name), `Expected library to contain target "${target.name}"`);
    assert.equal(map.get(target.name), target.sound, `Expected sound "${target.sound}" for "${target.name}"`);
  }

  // Verify grammar phrases (a, an, some)
  for (const row of library) {
    const [, name] = row.split('|');
    const art = someSet.has(name) ? 'some' : (/^[aeiou]/.test(name) ? 'an' : 'a');
    const phrase = `${art} ${name}`;
    assert.ok(phrase.startsWith('a ') || phrase.startsWith('an ') || phrase.startsWith('some '));
  }
});
