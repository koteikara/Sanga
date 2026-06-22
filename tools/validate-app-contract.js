#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const appPath = path.join(repoRoot, 'public/assets/app.js');
const htmlPath = path.join(repoRoot, 'public/sanga202627season.html');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const appJs = readText(appPath);
const html = readText(htmlPath);
const combined = `${appJs}\n${html}`;

function hasStringLiteral(source, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`([\'\"\`])${escaped}\\1`).test(source);
}

function getFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  if (start === -1) return '';

  const bodyStart = source.indexOf('{', start);
  if (bodyStart === -1) return '';

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }

  return '';
}

const normalizeMatchStateBody = getFunctionBody(appJs, 'normalizeMatchState');
const applyMatchStateBody = getFunctionBody(appJs, 'applyMatchState');
const cardFilterBody = getFunctionBody(appJs, 'doesCardMatchFilter');

const checks = [
  {
    label: 'LocalStorage key in public/assets/app.js',
    source: appJs,
    required: [
      'sanga-schedule-button-states-v1',
      'sanga-schedule-filter-settings-v1',
      'sanga-schedule-display-mode-v1',
      'sanga-schedule-layout-v1',
    ],
  },
  {
    label: 'JSON loading path in public/assets/app.js',
    source: appJs,
    required: ['data/matches.json'],
  },
  {
    label: 'HTML asset reference in public/sanga202627season.html',
    source: html,
    required: ['assets/app.js', 'assets/style.css'],
  },
  {
    label: 'DOM hook in HTML or JavaScript',
    source: combined,
    required: [
      '.help-button',
      '.help-panel',
      '.help-overlay',
      '.help-close',
      '.settings-button',
      '.settings-panel',
      '.settings-close',
      '.storage-clear',
      '.storage-clear-note',
      '.layout-option',
      '.display-mode-option',
      '.filter-option',
      '.filter-result',
      '.empty-filter-message',
      'json-preview-match',
      'json-preview-year',
    ],
  },

  {
    label: 'Schedule layout valid value in public/assets/app.js',
    source: appJs,
    required: ['1', '2', '3', '4'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Schedule layout CSS class in public/assets/app.js',
    source: appJs,
    required: ['layout-1', 'layout-3', 'layout-4'],
  },
  {
    label: 'Display mode valid value in public/assets/app.js',
    source: appJs,
    required: ['card', 'compact'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Display mode CSS class in public/assets/app.js',
    source: appJs,
    required: ['mode-card', 'mode-compact', 'display-mode-card', 'display-mode-compact'],
  },
  {
    label: 'Schedule filter valid value in public/assets/app.js',
    source: appJs,
    required: ['all', 'home', 'away', 'year-2026', 'year-2027', 'tentative', 'marked', 'state-1', 'state-2'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Match card state normalization value in public/assets/app.js',
    source: normalizeMatchStateBody,
    required: ['0', '1', '2'],
  },
  {
    label: 'Match card data-state handling in public/assets/app.js',
    source: applyMatchStateBody,
    required: ['dataset.state', 'normalizeMatchState'],
  },
  {
    label: 'Match card state filter handling in public/assets/app.js',
    source: cardFilterBody,
    required: ['state === 1', 'state === 2'],
  },
  {
    label: 'CSS-linked class in public/assets/app.js',
    source: appJs,
    required: [
      'json-preview-match',
      'json-preview-year',
      'is-screenshot-mode',
      'is-share-loading',
      'is-share-success',
      'is-share-error',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const includesItem = check.predicate || ((source, item) => source.includes(item));
  const missing = check.required.filter((item) => !includesItem(check.source, item));
  if (missing.length > 0) {
    failures.push({ label: check.label, missing });
  }
}

if (failures.length > 0) {
  console.error('JavaScript app contract validation failed.');
  for (const failure of failures) {
    console.error(`\n[${failure.label}]`);
    for (const item of failure.missing) {
      console.error(`- Missing: ${item}`);
    }
  }
  process.exit(1);
}

console.log('JavaScript app contract validation OK.');
