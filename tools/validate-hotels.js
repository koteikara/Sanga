#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const publicDataDir = path.join(repoRoot, 'public', 'data');
const matchesPath = path.join(publicDataDir, 'matches.json');
const hotelIndexPath = path.join(publicDataDir, 'hotel-index.json');
const hotelsDir = path.join(publicDataDir, 'hotels');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedPriceTiers = new Set(['budget', 'standard', 'premium']);
const allowedParkingTags = new Set(['available_free', 'available_paid', 'none', 'unknown']);
const allowedAccommodationTypeTags = new Set(['hotel', 'ryokan', 'unknown']);
const optionalHotelStringFields = [
  'parking_raw_text',
  'hotel_class_code_raw',
  'affiliate_url',
  'gourmet_area_note',
];
const optionalHotelBooleanFields = [
  'stadium_proximity',
  'sightseeing_friendly',
];

const errors = [];
const warnings = [];

function addError(location, message) {
  errors.push(`${location}: ${message}`);
}

function addWarning(location, message) {
  warnings.push(`${location}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isEmptyValue(value) {
  return value === undefined || value === null || value === '';
}

function readJsonFile(filePath, label) {
  let raw;

  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    addError(label, `${filePath} を読み込めません: ${error.message}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(label, `JSONとして読み込めません: ${error.message}`);
    return null;
  }
}

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDateString(location, field, value) {
  if (!isNonEmptyString(value)) {
    addError(location, `${field} は空でない文字列である必要があります`);
    return;
  }

  if (!datePattern.test(value)) {
    addError(location, `${field} は YYYY-MM-DD 形式である必要があります`);
    return;
  }

  if (!isRealDate(value)) {
    addError(location, `${field} は実在する日付である必要があります`);
  }
}

function validateOptionalDateString(location, field, value) {
  if (isEmptyValue(value)) return;
  validateDateString(location, field, value);
}

function validateOptionalString(location, field, value) {
  if (!isEmptyValue(value) && typeof value !== 'string') {
    addError(location, `${field} は文字列または null である必要があります`);
  }
}

function validateOptionalBoolean(location, field, value) {
  if (!isEmptyValue(value) && typeof value !== 'boolean') {
    addError(location, `${field} は boolean または null である必要があります`);
  }
}

function validateNumberOrNull(location, field, value) {
  if (value !== null && typeof value !== 'number') {
    addError(location, `${field} は number または null である必要があります`);
  }
}

function validateNonNegativeNumberOrNull(location, field, value) {
  validateNumberOrNull(location, field, value);
  if (typeof value === 'number' && value < 0) {
    addError(location, `${field} は0以上である必要があります`);
  }
}

function loadMatchIds() {
  const data = readJsonFile(matchesPath, 'matches.json');
  if (!isPlainObject(data) || !Array.isArray(data.matches)) {
    addError('matches.json', 'matches は配列である必要があります');
    return new Set();
  }

  return new Set(
    data.matches
      .filter((match) => isPlainObject(match) && isNonEmptyString(match.id))
      .map((match) => match.id)
  );
}

function validateHotelIndexMeta(meta) {
  if (!isPlainObject(meta)) {
    addError('hotel-index.json', 'meta はオブジェクトである必要があります');
    return;
  }

  ['updated_at', 'source', 'season'].forEach((field) => {
    if (typeof meta[field] !== 'string') {
      addError('hotel-index.json', `meta.${field} は文字列である必要があります`);
    }
  });
}

function normalizeDataPath(dataPath) {
  return dataPath.replace(/^\.\//, '');
}

function validateHotelIndexEntry(entry, index, matchIds, seenMatchIds) {
  const location = isPlainObject(entry) && isNonEmptyString(entry.match_id)
    ? `hotel-index.json:${entry.match_id}`
    : `hotel-index.json:matches[${index}]`;

  if (!isPlainObject(entry)) {
    addError(location, '各要素はオブジェクトである必要があります');
    return null;
  }

  if (!isNonEmptyString(entry.match_id)) {
    addError(location, 'match_id は空でない文字列である必要があります');
  } else {
    if (seenMatchIds.has(entry.match_id)) {
      addError(location, `match_id が ${seenMatchIds.get(entry.match_id)} と重複しています`);
    } else {
      seenMatchIds.set(entry.match_id, location);
    }

    if (!matchIds.has(entry.match_id)) {
      addError(location, 'match_id は public/data/matches.json の id と一致する必要があります');
    }
  }

  if (!isNonEmptyString(entry.stadium_id)) {
    addError(location, 'stadium_id は空でない文字列である必要があります');
  }

  validateDateString(location, 'checkin_date', entry.checkin_date);
  validateDateString(location, 'checkout_date', entry.checkout_date);

  if (isNonEmptyString(entry.checkin_date) && isNonEmptyString(entry.checkout_date) && entry.checkout_date < entry.checkin_date) {
    addError(location, 'checkout_date は checkin_date 以降である必要があります');
  }

  if (!Number.isInteger(entry.hotel_count) || entry.hotel_count < 0) {
    addError(location, 'hotel_count は0以上の整数である必要があります');
  }

  if (!isNonEmptyString(entry.data_path)) {
    addError(location, 'data_path は空でない文字列である必要があります');
    return null;
  }

  const normalizedDataPath = normalizeDataPath(entry.data_path);
  if (!normalizedDataPath.startsWith('data/hotels/') || !normalizedDataPath.endsWith('.json')) {
    addError(location, 'data_path は data/hotels/{match_id}.json 形式である必要があります');
  }

  const expectedPath = `data/hotels/${entry.match_id}.json`;
  if (isNonEmptyString(entry.match_id) && normalizedDataPath !== expectedPath) {
    addError(location, `data_path は ${expectedPath} である必要があります`);
  }

  const absoluteDataPath = path.join(repoRoot, 'public', normalizedDataPath.replace(/^data\//, 'data/'));
  if (!fs.existsSync(absoluteDataPath)) {
    addError(location, `${entry.data_path} が存在しません`);
  }

  return {
    matchId: entry.match_id,
    hotelCount: entry.hotel_count,
    dataPath: absoluteDataPath,
  };
}

function validateHotelIndex(matchIds) {
  const data = readJsonFile(hotelIndexPath, 'hotel-index.json');
  const indexedDetails = new Map();

  if (!isPlainObject(data)) {
    addError('hotel-index.json', 'ルートはオブジェクトである必要があります');
    return indexedDetails;
  }

  validateHotelIndexMeta(data.meta);

  if (!Array.isArray(data.matches)) {
    addError('hotel-index.json', 'matches は配列である必要があります');
    return indexedDetails;
  }

  const seenMatchIds = new Map();
  data.matches.forEach((entry, index) => {
    const detail = validateHotelIndexEntry(entry, index, matchIds, seenMatchIds);
    if (detail && isNonEmptyString(detail.matchId)) {
      indexedDetails.set(detail.matchId, detail);
    }
  });

  return indexedDetails;
}

function validateSearchConditions(location, searchConditions) {
  if (!isPlainObject(searchConditions)) {
    addError(location, 'meta.search_conditions はオブジェクトである必要があります');
    return;
  }

  ['adult_num', 'up_class_num', 'low_class_num', 'search_radius'].forEach((field) => {
    if (!Number.isInteger(searchConditions[field]) || searchConditions[field] < 0) {
      addError(location, `meta.search_conditions.${field} は0以上の整数である必要があります`);
    }
  });
}

function validateHotelDocumentMeta(meta, location, matchId, matchIds) {
  if (!isPlainObject(meta)) {
    addError(location, 'meta はオブジェクトである必要があります');
    return;
  }

  if (meta.match_id !== matchId) {
    addError(location, `meta.match_id は ${matchId} である必要があります`);
  }

  if (!matchIds.has(meta.match_id)) {
    addError(location, 'meta.match_id は public/data/matches.json の id と一致する必要があります');
  }

  if (!isNonEmptyString(meta.stadium_id)) {
    addError(location, 'meta.stadium_id は空でない文字列である必要があります');
  }

  validateOptionalDateString(location, 'meta.match_date', meta.match_date);
  validateDateString(location, 'meta.checkin_date', meta.checkin_date);
  validateDateString(location, 'meta.checkout_date', meta.checkout_date);

  if (isNonEmptyString(meta.checkin_date) && isNonEmptyString(meta.checkout_date) && meta.checkout_date < meta.checkin_date) {
    addError(location, 'meta.checkout_date は meta.checkin_date 以降である必要があります');
  }

  if (typeof meta.updated_at !== 'string') {
    addError(location, 'meta.updated_at は文字列である必要があります');
  }

  if (!isNonEmptyString(meta.source)) {
    addError(location, 'meta.source は空でない文字列である必要があります');
  }

  validateSearchConditions(location, meta.search_conditions);
}

function validateHotel(hotel, index, location) {
  const hotelLocation = `${location}:hotels[${index}]`;

  if (!isPlainObject(hotel)) {
    addError(hotelLocation, '各ホテルはオブジェクトである必要があります');
    return;
  }

  if (!Number.isInteger(hotel.hotel_no)) {
    addError(hotelLocation, 'hotel_no は整数である必要があります');
  }

  if (!isNonEmptyString(hotel.hotel_name)) {
    addError(hotelLocation, 'hotel_name は空でない文字列である必要があります');
  }

  if (!isNonEmptyString(hotel.stadium_id)) {
    addError(hotelLocation, 'stadium_id は空でない文字列である必要があります');
  }

  validateNumberOrNull(hotelLocation, 'latitude', hotel.latitude);
  validateNumberOrNull(hotelLocation, 'longitude', hotel.longitude);
  validateNonNegativeNumberOrNull(hotelLocation, 'distance_km_from_stadium', hotel.distance_km_from_stadium);
  validateNonNegativeNumberOrNull(hotelLocation, 'min_charge', hotel.min_charge);
  validateNonNegativeNumberOrNull(hotelLocation, 'max_charge', hotel.max_charge);

  if (typeof hotel.min_charge === 'number' && typeof hotel.max_charge === 'number' && hotel.max_charge < hotel.min_charge) {
    addError(hotelLocation, 'max_charge は min_charge 以上である必要があります');
  }

  if (!allowedPriceTiers.has(hotel.price_tier)) {
    addError(hotelLocation, 'price_tier は budget / standard / premium のいずれかである必要があります');
  }

  if (!allowedParkingTags.has(hotel.parking_tag)) {
    addError(hotelLocation, 'parking_tag は available_free / available_paid / none / unknown のいずれかである必要があります');
  }

  if (!allowedAccommodationTypeTags.has(hotel.accommodation_type_tag)) {
    addError(hotelLocation, 'accommodation_type_tag は hotel / ryokan / unknown のいずれかである必要があります');
  }

  optionalHotelStringFields.forEach((field) => validateOptionalString(hotelLocation, field, hotel[field]));
  optionalHotelBooleanFields.forEach((field) => validateOptionalBoolean(hotelLocation, field, hotel[field]));
}

function validateHotelDocument(filePath, matchId, matchIds, indexedDetail) {
  const relativePath = path.relative(repoRoot, filePath);
  const data = readJsonFile(filePath, relativePath);

  if (!isPlainObject(data)) {
    addError(relativePath, 'ルートはオブジェクトである必要があります');
    return;
  }

  if (data.match_id !== matchId) {
    addError(relativePath, `match_id は ${matchId} である必要があります`);
  }

  if (!Number.isInteger(data.hotel_count) || data.hotel_count < 0) {
    addError(relativePath, 'hotel_count は0以上の整数である必要があります');
  }

  if (!Array.isArray(data.hotels)) {
    addError(relativePath, 'hotels は配列である必要があります');
  } else {
    if (Number.isInteger(data.hotel_count) && data.hotel_count !== data.hotels.length) {
      addError(relativePath, 'hotel_count は hotels の件数と一致する必要があります');
    }

    data.hotels.forEach((hotel, index) => validateHotel(hotel, index, relativePath));
  }

  validateHotelDocumentMeta(data.meta, relativePath, matchId, matchIds);

  if (indexedDetail) {
    if (Number.isInteger(data.hotel_count) && indexedDetail.hotelCount !== data.hotel_count) {
      addError(relativePath, 'hotel_count は hotel-index.json の hotel_count と一致する必要があります');
    }
  } else {
    addError(relativePath, 'hotel-index.json に対応する索引が必要です');
  }
}

function collectHotelDetailFiles() {
  if (!fs.existsSync(hotelsDir)) return [];

  return fs.readdirSync(hotelsDir, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(hotelsDir, entry.name))
    .sort();
}

function main() {
  const matchIds = loadMatchIds();
  const indexedDetails = validateHotelIndex(matchIds);
  const detailFiles = collectHotelDetailFiles();

  detailFiles.forEach((filePath) => {
    const matchId = path.basename(filePath, '.json');
    validateHotelDocument(filePath, matchId, matchIds, indexedDetails.get(matchId));
  });

  indexedDetails.forEach((detail, matchId) => {
    const expectedFile = path.join(hotelsDir, `${matchId}.json`);
    if (!detailFiles.includes(expectedFile)) {
      addError('hotel-index.json', `${detail.dataPath} が hotels ディレクトリのJSON一覧に含まれていません`);
    }
  });

  warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));

  if (errors.length > 0) {
    console.error('Hotel data validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Hotel data validation OK: index entries=${indexedDetails.size}, detail files=${detailFiles.length}`);
}

main();
