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
  const missing = check.required.filter((item) => !check.source.includes(item));
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
