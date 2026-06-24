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
const cardFilterDefinitionBody = getFunctionBody(appJs, 'doesCardMatchDefinition');
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
    required: ['all', 'home', 'away', 'year-2026', 'year-2027', 'tentative', 'marked', 'state-1', 'state-2', 'competition-j1', 'competition-emp', 'competition-lev'],
    predicate: (source, item) => hasHtmlAttributeValue(source, 'data-filter', item),
  },
  {
    label: 'Schedule filter visible label in public/sanga202627season.html',
    source: html,
    required: ['すべて', 'HOME', 'AWAY', '2026', '2027', '未確定', '枠線あり', '赤色枠', '水色枠', 'J1', '天皇杯', 'ルヴァン杯'],
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
    label: 'Schedule layout definition contract in public/assets/app.js',
    source: appJs,
    required: ['LAYOUT_DEFINITIONS', 'VALID_LAYOUTS=Object.keys(LAYOUT_DEFINITIONS)', 'LAYOUT_PHONE_CLASSES', 'normalizeLayout', 'getLayoutDefinition', 'updatePhoneLayoutClass', 'updateLayoutButtonStates', 'setScheduleLayout'],
  },
  {
    label: 'Schedule layout valid value in public/assets/app.js',
    source: appJs,
    required: ['1', '2', '3', '4'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Schedule layout label in public/assets/app.js',
    source: appJs,
    required: ['1列', '2列', '3列', '4列'],
  },
  {
    label: 'Schedule layout CSS class in public/assets/app.js',
    source: appJs,
    required: ['layout-1', 'layout-3', 'layout-4'],
  },
  {
    label: 'Schedule layout keeps two-column default without layout-2 in public/assets/app.js',
    source: appJs,
    required: ["'2':{label:'2列', phoneClass:''}"],
  },
  {
    label: 'Display mode definition contract in public/assets/app.js',
    source: appJs,
    required: ['DISPLAY_MODE_DEFINITIONS', 'VALID_DISPLAY_MODES=Object.keys(DISPLAY_MODE_DEFINITIONS)', 'DISPLAY_MODE_PHONE_CLASSES', 'DISPLAY_MODE_LIST_CLASSES', 'getDisplayModeDefinition', 'updatePhoneDisplayModeClass', 'updateListDisplayModeClass', 'updateDisplayModeButtonStates', 'normalizeDisplayMode', 'applyDisplayMode'],
  },
  {
    label: 'Display mode valid value in public/assets/app.js',
    source: appJs,
    required: ['card', 'compact'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Display mode label in public/assets/app.js',
    source: appJs,
    required: ['通常カード', 'コンパクト'],
  },
  {
    label: 'Display mode CSS class in public/assets/app.js',
    source: appJs,
    required: ['mode-card', 'mode-compact', 'display-mode-card', 'display-mode-compact'],
  },
  {
    label: 'Schedule filter valid value in public/assets/app.js',
    source: appJs,
    required: ['all', 'home', 'away', 'year-2026', 'year-2027', 'tentative', 'marked', 'state-1', 'state-2', 'competition-j1', 'competition-emp', 'competition-lev'],
    predicate: hasStringLiteral,
  },
  {
    label: 'Schedule filter label in public/assets/app.js',
    source: appJs,
    required: ['すべて', 'HOME', 'AWAY', '2026', '2027', '未確定', '枠線あり', '赤色枠', '水色枠', 'J1', '天皇杯', 'ルヴァン杯'],
  },
  {
    label: 'Schedule filter definition contract in public/assets/app.js',
    source: appJs,
    required: ['FILTER_DEFINITIONS', 'VALID_FILTERS=Object.keys(FILTER_DEFINITIONS)', 'FILTER_LABELS=Object.fromEntries', 'getFilterDefinition', 'getFilterLabel', 'doesCardMatchDefinition'],
  },
  {
    label: 'Competition filter handling in public/assets/app.js',
    source: appJs,
    required: ["'competition-j1':{label:'J1', type:'competition', value:'J1'}", "'competition-emp':{label:'天皇杯', type:'competition', value:'EMP'}", "'competition-lev':{label:'ルヴァン杯', type:'competition', value:'LEV'}", 'getCardCompetition(card) === definition.value'],
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
    source: `${appJs}
${cardFilterDefinitionBody}`,
    required: ["'marked':{label:'枠線あり', type:'stateAny', values:[1,2]}", "'state-1':{label:'赤色枠', type:'state', value:1}", "'state-2':{label:'水色枠', type:'state', value:2}", 'definition.values.includes(state)', 'state === definition.value'],
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
