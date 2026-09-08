/**
 * ICS（iCalendar）の組み立て。
 *
 * **ここが受け持つのは「どう書くか」だけです。「何を出すか」は呼ぶ側が決めます。**
 * 設計は docs/supporter-timeline-design.md の「購読フィード」の
 * 「ICSの組み立ては下回りだけ共通化する」を正とします。
 *
 * 使う側は2つあり、出すものが違います。
 *   - public/assets/timeline.js … 画面から書き出す1回きりの取り込み。
 *     プロフィールと引き換え予定で絞り、MY予定も入る
 *   - フィードの生成（段階2以降） … 絞らない。墓標（STATUS:CANCELLED）が要る
 *
 * どちらも同じ形のVEVENTになるよう、組み立てはこの1箇所に置きます。2本持つと、
 * ダウンロードしたファイルと購読フィードで中身が静かにズレます。
 *
 * ブラウザからも Node からも読めるよう ES モジュールにしています。Node 側は
 * tools/validate-squad-contract.mjs と同じく `import()` で読みます。
 * **DOM も window も使いません。**
 */

/** 特別な意味を持つ文字を逃がす。RFC 5545 3.3.11。 */
export function icsEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/** UTCの `20260911T100000Z` を作る。日時を持つ予定はこの形で書く。 */
export function toUtcStamp(date) {
  return date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + "Z";
}

/**
 * 終日の予定の `20260911` を作る。**端末のタイムゾーンで読む。**
 * UTCで読むと、日本時間の朝の予定が前日になってしまう。
 */
export function toDateStamp(date) {
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
}

/**
 * 1行の上限（オクテット）。RFC 5545 3.1 が定める。超える行は次の行へ折り返し、
 * 続きの行は空白1つで始める。
 *
 * **日本語の予定では簡単に超えます。** 1文字3オクテットなので、説明欄は25文字ほどで
 * 上限に達します。折り返さないファイルでも Google と Apple は読めますが、規格どおりに
 * しないと厳しい実装で弾かれます。
 */
const MAX_OCTETS = 75;

/**
 * 規格どおりに折り返す。**文字の途中では切りません。**
 * オクテット数で数えつつ、UTF-8の文字境界を守る。
 */
export function foldLine(line) {
  // TextEncoder はブラウザにも Node にもある。Buffer は Node にしかないので使わない。
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_OCTETS) return line;

  const out = [];
  let current = "";
  let octets = 0;
  // 続きの行は先頭の空白1つぶんだけ入る量が減る。
  let limit = MAX_OCTETS;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      out.push(current);
      current = char;
      octets = size;
      limit = MAX_OCTETS - 1;
    } else {
      current += char;
      octets += size;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** UIDのドメイン部分。実在しないことが保証された名前で、置き場所が変わっても動かない。 */
export const UID_DOMAIN = "sanga-timeline.invalid";

/**
 * VEVENTを1つ組み立てる。渡された値をそのまま書くだけで、何も判断しません。
 *
 * @param {object} spec
 * @param {string} spec.uid          ドメイン部分の手前まで。ここで `@` 以降を足す
 * @param {Date}   spec.start        始まり。必須
 * @param {Date|null} [spec.end]     終わり。無ければ書かない
 * @param {boolean} [spec.allDay]    終日として書くか（日付だけの予定）
 * @param {string} spec.summary      題
 * @param {string} [spec.description] 説明
 * @param {number|null} [spec.sequence]     版。0以上の整数
 * @param {Date|null}   [spec.lastModified] 版を上げた時刻
 * @param {string} [spec.status]     STATUS。省略時は CONFIRMED
 * @param {Date} now                 DTSTAMP に書く時刻
 */
function buildEvent(spec, now) {
  const lines = ["BEGIN:VEVENT"];
  lines.push("UID:" + icsEscape(spec.uid) + "@" + UID_DOMAIN);
  lines.push("DTSTAMP:" + toUtcStamp(now));

  // 版が無いと、同じUIDでもカレンダー側は更新と判断できない。
  // 版を上げるかどうかは tools/generate-calendar-events.js の ICS_FIELDS が決める。
  // ここで VEVENT に書く項目を足し引きしたら、あちらの一覧も合わせること。
  if (typeof spec.sequence === "number" && spec.sequence >= 0) {
    lines.push("SEQUENCE:" + Math.floor(spec.sequence));
  }
  if (spec.lastModified) lines.push("LAST-MODIFIED:" + toUtcStamp(spec.lastModified));

  if (spec.allDay) {
    lines.push("DTSTART;VALUE=DATE:" + toDateStamp(spec.start));
  } else {
    lines.push("DTSTART:" + toUtcStamp(spec.start));
    // DTEND を省くとアプリごとに違う長さになる（Outlookは1時間として取り込む）。
    // 長さは呼ぶ側が決める。ここでは補わない。
    if (spec.end) lines.push("DTEND:" + toUtcStamp(spec.end));
  }

  lines.push("SUMMARY:" + icsEscape(spec.summary));
  lines.push("DESCRIPTION:" + icsEscape(spec.description || ""));

  // **STATUS は常に出す。** 普段から出しておけば、中止のときの CANCELLED が
  // 「値が変わった」だけになり、「無かった項目が増えた」という扱いにならない。
  // Googleの公開フィード（祝日）も全イベントに CONFIRMED を出している。
  lines.push("STATUS:" + (spec.status || "CONFIRMED"));

  // 空き時間を埋めない。販売開始はその時間に何かするわけではなく、キックオフも
  // 観に行くとは限らない。埋めると、予定を共有している相手からは「その時間は
  // 埋まっている人」に見えてしまう。Googleの公開フィード（祝日）と同じ扱い。
  lines.push("TRANSP:TRANSPARENT");

  lines.push("END:VEVENT");
  return lines;
}

/**
 * VCALENDAR を組み立てて文字列で返す。改行は CRLF（RFC 5545 の定め）。
 *
 * @param {object[]} specs  buildEvent が受け取る形の配列。start が無いものは飛ばす
 * @param {object} options
 * @param {Date}   options.now          DTSTAMP に書く時刻
 * @param {string} options.calendarName X-WR-CALNAME
 * @param {string} options.prodId       PRODID
 * @param {string} [options.calendarDescription] X-WR-CALDESC
 * @param {string} [options.refreshInterval]     取りに来る間隔の希望（`PT12H` の形）。
 *   購読フィードだけが使う。どれを見るかはアプリによって違うので2つの形で書く。
 *   **強制はできない。** 決めるのはカレンダーアプリ側
 */
export function buildCalendar(specs, options) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:" + options.prodId,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEscape(options.calendarName)
  ];

  if (options.calendarDescription) {
    lines.push("X-WR-CALDESC:" + icsEscape(options.calendarDescription));
  }
  if (options.refreshInterval) {
    lines.push("REFRESH-INTERVAL;VALUE=DURATION:" + options.refreshInterval);
    lines.push("X-PUBLISHED-TTL:" + options.refreshInterval);
  }

  specs.forEach(function (spec) {
    if (!spec || !spec.start) return;
    buildEvent(spec, options.now).forEach(function (line) { lines.push(line); });
  });

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
