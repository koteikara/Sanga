#!/usr/bin/env node

// 選手データ public/data/players.json の検証スクリプト。
// docs/players-data-schema.md の「検証で確認すること」を実装する。

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const playersPath = path.join(repoRoot, 'public', 'data', 'players.json');
const publicDir = path.join(repoRoot, 'public');
const ALLOWED_POSITIONS = new Set(['GK', 'DF', 'MF', 'FW']);
// ベンチ表示用の省略名の上限。全角1文字＝1、半角1文字＝0.5として数える。
// 表示枠に入るのは約4.2文字ぶんで、これを超える分は横方向に圧縮して収める。
// 6を超えると圧縮が強くなりすぎて読みにくいため、ここで止める。
const NAME_SHORT_MAX_WIDTH = 6;

// 国旗のCSS定義を探すファイル。squad.css は今後 public/assets/ に追加される予定だが、
// 本タスクでは public/assets/ に触れないため、現時点で国旗が定義済みの
// experiments/squad-builder/design-mockup.html も候補に含める。
// （このスクリプトはこれらのファイルを読み取るだけで、変更は行わない）
const FLAG_CSS_CANDIDATES = [
  path.join(publicDir, 'assets', 'squad.css'),
  path.join(repoRoot, 'experiments', 'squad-builder', 'design-mockup.html'),
];

const errors = [];
const warnings = [];

function addError(location, field, message) {
  errors.push(`${location}: ${field} - ${message}`);
}

/** 表示幅の目安。全角1文字＝1、半角1文字＝0.5として数える */
function displayWidth(text) {
  return Array.from(text).reduce((total, char) => total + (char.codePointAt(0) < 0x3000 ? 0.5 : 1), 0);
}

function addWarning(location, field, message) {
  warnings.push(`${location}: ${field} - ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    addError(label, 'file', `${filePath} を読み込めません: ${error.message}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(label, 'JSON', `JSONとして読み込めません: ${error.message}`);
    return null;
  }
}

function collectDefinedFlagCodes() {
  const codes = new Set();
  let found = false;

  FLAG_CSS_CANDIDATES.forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;
    found = true;
    const text = fs.readFileSync(filePath, 'utf8');
    const pattern = /\.flag-([a-z]{2,3})\b/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      codes.add(match[1]);
    }
  });

  return { codes, found };
}

function resolveImagePath(player) {
  const relative = isNonEmptyString(player.image) ? player.image : `assets/players/${player.number}.webp`;
  return { relative, absolute: path.join(publicDir, relative), explicit: isNonEmptyString(player.image) };
}

function validatePlayers(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    addError('players.json', 'root', 'ルートはオブジェクトである必要があります');
    return [];
  }

  if (!Array.isArray(data.players)) {
    addError('players.json', 'players', 'players は配列である必要があります');
    return [];
  }

  const { codes: definedFlagCodes, found: flagCssFound } = collectDefinedFlagCodes();
  if (!flagCssFound) {
    addWarning('players.json', 'nationality', '国旗定義のCSSが見つからないため、国籍とCSSの対応チェックを省略しました');
  }

  const seenNumbers = new Map();

  const seenShortNames = new Map();

  data.players.forEach((player, index) => {
    const location = isNonEmptyString(player && player.number) ? `#${player.number}` : `players[${index}]`;

    if (!player || typeof player !== 'object' || Array.isArray(player)) {
      addError(location, 'entry', '各要素はオブジェクトである必要があります');
      return;
    }

    if (!isNonEmptyString(player.number)) {
      addError(location, 'number', '空でない文字列である必要があります');
    } else if (seenNumbers.has(player.number)) {
      addError(location, 'number', `${seenNumbers.get(player.number)} と重複しています`);
    } else {
      seenNumbers.set(player.number, location);
    }

    if (!isNonEmptyString(player.nameEn)) {
      addError(location, 'nameEn', '空でない文字列である必要があります');
    }

    if (!isNonEmptyString(player.nameShort)) {
      addError(location, 'nameShort', '空でない文字列である必要があります（ベンチ表示用の省略名）');
    } else {
      if (seenShortNames.has(player.nameShort)) {
        addError(
          location,
          'nameShort',
          `${seenShortNames.get(player.nameShort)} と重複しています。姓が重なる場合はユニフォーム表記に合わせて区別してください`
        );
      } else {
        seenShortNames.set(player.nameShort, location);
      }
      const width = displayWidth(player.nameShort);
      if (width > NAME_SHORT_MAX_WIDTH) {
        addError(location, 'nameShort', `全角${NAME_SHORT_MAX_WIDTH}文字ぶん以内にしてください（現在 ${width}）`);
      }
    }

    const isMascot = player.isMascot === true;

    if (!isMascot) {
      if (!ALLOWED_POSITIONS.has(player.position)) {
        addError(location, 'position', 'GK / DF / MF / FW のいずれかにしてください');
      }
    } else if (isNonEmptyString(player.position) && !ALLOWED_POSITIONS.has(player.position)) {
      // マスコットは選手ではないためポジション必須ではないが、値がある場合は形式だけ確認する
      addError(location, 'position', 'GK / DF / MF / FW のいずれかにしてください');
    }

    if (!isNonEmptyString(player.nationality)) {
      addError(location, 'nationality', '空でない文字列である必要があります');
    } else if (flagCssFound && !definedFlagCodes.has(player.nationality)) {
      addError(location, 'nationality', `国旗の定義（.flag-${player.nationality}）がCSSに見つかりません`);
    }

    const { relative, absolute, explicit } = resolveImagePath(player);
    if (!fs.existsSync(absolute)) {
      if (explicit) {
        addError(location, 'image', `画像ファイルが見つかりません: ${relative}`);
      } else {
        // 背番号から自動解決した画像が未取得の場合は、プレースホルダー表示で運用する想定のため警告にとどめる
        addWarning(location, 'image', `背番号から解決した画像ファイルが見つかりません（プレースホルダー表示になります）: ${relative}`);
      }
    }
  });

  return data.players;
}

const data = readJsonFile(playersPath, 'players.json');
let players = [];
if (data) {
  players = validatePlayers(data);
}

if (errors.length > 0) {
  console.error('選手データの検証に失敗しました。');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`選手データの検証に成功しました。players.json は${players.length}件です。`);
console.log('背番号重複・position・nationality・nameEn・nameShort（重複と長さ）・画像の存在チェックを確認しました。');
if (warnings.length > 0) {
  console.log('警告:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
