#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const appPath = path.join(repoRoot, 'public/assets/app.js');
const htmlPath = path.join(repoRoot, 'public/sanga202627season.html');
const cssPath = path.join(repoRoot, 'public/assets/style.css');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const appJs = readText(appPath);
const html = readText(htmlPath);
const css = readText(cssPath);
const combined = `${appJs}\n${html}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasStringLiteral(source, value) {
  const escaped = escapeRegExp(value);
  return new RegExp(`([\'"\`])${escaped}\\1`).test(source);
}

function hasHtmlAttributeValue(source, attribute, value) {
  const escapedAttribute = escapeRegExp(attribute);
  const escapedValue = escapeRegExp(value);
  return new RegExp(`${escapedAttribute}=["']${escapedValue}["']`).test(source);
}

function hasClassSelector(source, className) {
  const escaped = escapeRegExp(className);
  return new RegExp(`\\.${escaped}(?![a-zA-Z0-9_-])`).test(source);
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
const shareGenerationStateBody = getFunctionBody(appJs, 'setShareGenerationState');
const generateShareImageBody = getFunctionBody(appJs, 'generateShareImage');
const competitionBadgeTextBody = getFunctionBody(appJs, 'getCompetitionBadgeText');
const createJsonMatchCardBody = getFunctionBody(appJs, 'createJsonMatchCard');

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
      '.share-image-actions',
      '.share-generate-button',
      '.share-save-link',
      '.share-save-help',
      '.share-status',
      '.share-progress',
      '.share-preview',
      '.share-preview-image',
      '.screenshot-exit-button',
      'json-preview-match',
      'json-preview-year',
    ],
  },
  {
    label: 'Data attribute hook in public/sanga202627season.html',
    source: html,
    required: ['data-json-preview-list', 'data-share-capture-target'],
  },
  {
    label: 'Schedule layout button value in public/sanga202627season.html',
    source: html,
    required: ['1', '2', '3', '4'],
    predicate: (source, item) => hasHtmlAttributeValue(source, 'data-layout', item),
  },
  {
    label: 'Display mode button value in public/sanga202627season.html',
    source: html,
    required: ['card', 'compact'],
    predicate: (source, item) => hasHtmlAttributeValue(source, 'data-display-mode', item),
  },
  {
    label: 'Schedule filter button value in public/sanga202627season.html',
    source: html,
    required: ['all', 'home', 'away', 'year-2026', 'year-2027', 'tentative', 'marked', 'state-1', 'state-2'],
    predicate: (source, item) => hasHtmlAttributeValue(source, 'data-filter', item),
  },
  {
    label: 'Schedule filter visible label in public/sanga202627season.html',
    source: html,
    required: ['すべて', 'HOME', 'AWAY', '2026', '2027', '未確定', '枠線あり', '赤色枠', '水色枠'],
  },
  {
    label: 'CSS hook in public/assets/style.css',
    source: css,
    required: [
      'layout-1',
      'layout-3',
      'layout-4',
      'display-mode-compact',
      'is-screenshot-mode',
      'is-share-loading',
      'is-share-success',
      'is-share-error',
      'competition-ribbon',
      'competition-j1',
      'competition-emp',
      'competition-lev',
      'share-capture-target',
      'share-progress',
      'share-preview',
      'share-preview-card',
      'screenshot-exit-button',
    ],
    predicate: hasClassSelector,
  },
  {
    label: 'Match card state CSS hook in public/assets/style.css',
    source: css,
    required: ['.match[data-state="1"]', '.match[data-state="2"]'],
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
    label: 'Schedule filter label in public/assets/app.js',
    source: appJs,
    required: ['すべて', 'HOME', 'AWAY', '2026', '2027', '未確定', '枠線あり', '赤色枠', '水色枠'],
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
  {
    label: 'Share image generation import in public/assets/app.js',
    source: appJs,
    required: ['modern-screenshot@4.6.5', 'domToPng'],
  },
  {
    label: 'Share image generation behavior in public/assets/app.js',
    source: generateShareImageBody,
    required: ['shareCaptureTarget', 'domToPng', 'backgroundColor', "setShareGenerationState('success')", "setShareGenerationState('error')", 'shareSaveLink', 'sharePreviewImage'],
  },
  {
    label: 'Share image state handling in public/assets/app.js',
    source: shareGenerationStateBody,
    required: ['loading', 'success', 'error', 'is-share-loading', 'is-share-success', 'is-share-error', 'data-share-generation-state'],
  },
  {
    label: 'Share preview accessibility and exit control in public/sanga202627season.html',
    source: html,
    required: ['class="share-preview-image" alt=', 'screenshot-exit-button'],
  },
  {
    label: 'Competition ribbon label mapping in public/assets/app.js',
    source: competitionBadgeTextBody,
    required: ['J1', 'EMP', 'LEV'],
  },
  {
    label: 'Competition ribbon class generation in public/assets/app.js',
    source: createJsonMatchCardBody,
    required: ['competition-ribbon', 'competition-', 'match.competition'],
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
  console.error('App contract validation failed.');
  for (const failure of failures) {
    console.error(`\n[app-contract] ${failure.label}`);
    for (const item of failure.missing) {
      console.error(`[app-contract] missing contract item: ${item}`);
    }
  }
  process.exit(1);
}

console.log('App contract validation OK.');
