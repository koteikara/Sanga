#!/usr/bin/env node

/**
 * 取り込みの滞りを挙げる。
 *
 * 設計は docs/supporter-timeline-design.md の「取り込みの滞りを知らせる」を正とする。
 *
 * 2026-09-17〜10-07 に、自動の取り込みPRが16本マージされないまま溜まり、
 * 10/3 からは公式サイトの503で取得も4日続けて落ちていた。どちらも誰も気付かなかった。
 * この道具は、その2つの状態だけを見る。
 *
 * | 状態 | 判定 |
 * | --- | --- |
 * | 取り込み待ち | 取り込みPRが開いたまま、最初の未マージ取り込みから `--stale-days` 日以上 |
 * | 取得の失敗 | このワークフローの実行が、新しいほうから `--fail-days` 回以上続けて失敗 |
 *
 * **外へは1リクエストも出さない。** PRと実行の一覧はワークフローが `gh` で取り、
 * JSONファイルで渡す。手元の作り物で結果を確かめられるようにするため。
 *
 * 出力はGitHubのIssue本文にそのまま貼れるMarkdown。滞りが無ければ何も出さない。
 * **静かなのが正常。** 本文の先頭に、どの状態に当たったかを隠しコメントで残す。
 * ワークフローはそれを前回の本文と比べ、新しく当たった状態があるときだけメンションする。
 */

const fs = require('fs');

/** 取り込みPRのブランチ名の頭。ticket-sales-sync.yml が付ける。 */
const BRANCH_PREFIX = 'automation/ticket-sales-';

/**
 * 最初の未マージ取り込みの日時。PR本文の隠しコメントに入る。
 * 新しいPRが古いPRを閉じて引き継ぐため、PRの作成日時だけでは滞りの長さが分からない。
 */
const PENDING_SINCE = /<!--\s*pending-since:\s*([0-9T:.+\-Z]+)\s*-->/;

const DAY_MS = 24 * 60 * 60 * 1000;

function usage() {
  console.error('使い方: node tools/report-sync-stall.js --prs <json> --runs <json> [options]');
  console.error('  --prs <json>          gh pr list --json number,url,createdAt,headRefName,body の出力');
  console.error('  --runs <json>         gh run list --json databaseId,status,conclusion,createdAt,url の出力（新しい順）');
  console.error('  --current-run-id <id> いま動いている実行。--runs から除き、--current-failed で数える');
  console.error('  --current-failed      いま動いている実行が失敗している');
  console.error('  --now <ISO日時>       基準の時刻（既定: 現在）');
  console.error('  --stale-days <日数>   取り込み待ちを知らせる日数（既定: 3）');
  console.error('  --fail-days <回数>    取得の失敗を知らせる連続回数（既定: 2）');
  console.error('  --mention <ユーザー>  本文の先頭で知らせる相手（@は付けない）');
}

function parseArgs(argv) {
  const args = { staleDays: 3, failDays: 2, currentFailed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} に値がありません`);
      i += 1;
      return value;
    };
    if (arg === '--prs') args.prs = next();
    else if (arg === '--runs') args.runs = next();
    else if (arg === '--current-run-id') args.currentRunId = next();
    else if (arg === '--current-failed') args.currentFailed = true;
    else if (arg === '--now') args.now = next();
    else if (arg === '--stale-days') args.staleDays = Number(next());
    else if (arg === '--fail-days') args.failDays = Number(next());
    else if (arg === '--mention') args.mention = next();
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else throw new Error(`不明なオプションです: ${arg}`);
  }
  if (!args.prs || !args.runs) throw new Error('--prs と --runs は必須です');
  if (!(args.staleDays > 0) || !(args.failDays > 0)) throw new Error('--stale-days と --fail-days は正の数にしてください');
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 表示はJSTの日付と時刻。読む人は日本にいる。 */
function formatJst(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())} JST`;
}

function pendingSince(pr) {
  const match = PENDING_SINCE.exec(pr.body || '');
  const since = new Date(match ? match[1] : pr.createdAt);
  return Number.isNaN(since.getTime()) ? new Date(pr.createdAt) : since;
}

/** 開いている取り込みPRのうち、いちばん古くから待っているもの。 */
function stalePr(prs, now, staleDays) {
  const open = prs
    .filter((pr) => String(pr.headRefName || '').startsWith(BRANCH_PREFIX))
    .map((pr) => ({ ...pr, since: pendingSince(pr) }))
    .sort((a, b) => a.since - b.since);
  if (open.length === 0) return null;
  const oldest = open[0];
  const days = Math.floor((now - oldest.since) / DAY_MS);
  if (days < staleDays) return null;
  return { ...oldest, days, count: open.length };
}

/**
 * 新しいほうから続けて失敗した実行。
 * 取り消し（cancelled）と実行中は数えずに飛ばす。成功が出たところで止める。
 */
function failStreak(runs, currentRunId, currentFailed) {
  const streak = [];
  if (currentRunId) {
    if (!currentFailed) return streak;
    streak.push({ databaseId: currentRunId, current: true });
  }
  for (const run of runs) {
    if (currentRunId && String(run.databaseId) === String(currentRunId)) continue;
    if (run.status !== 'completed') continue;
    if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') continue;
    if (run.conclusion !== 'failure') break;
    streak.push(run);
  }
  return streak;
}

function report(args) {
  const prs = readJson(args.prs);
  const runs = readJson(args.runs);
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now を日時として読めません: ${args.now}`);

  const keys = [];
  const sections = [];

  const pr = stalePr(prs, now, args.staleDays);
  if (pr) {
    keys.push('pr-stale');
    const lines = [];
    lines.push('## 取り込みPRがマージされていません');
    lines.push('');
    lines.push(`最初の未マージ取り込みから **${pr.days}日** たっています（${formatJst(pr.since)} から）。`);
    lines.push('マージされるまで、`main` と本番のチケット情報は古いままです。');
    lines.push('');
    lines.push(`- 確認するPR: ${pr.url}`);
    if (pr.count > 1) {
      lines.push(`- 開いている取り込みPRが ${pr.count} 本あります。新しいPRが古いものを含むので、最新の1本を見れば足ります。`);
    }
    sections.push(lines.join('\n'));
  }

  const streak = failStreak(runs, args.currentRunId, args.currentFailed);
  if (streak.length >= args.failDays) {
    keys.push('fetch-fail');
    const lines = [];
    lines.push('## 取り込みが続けて失敗しています');
    lines.push('');
    lines.push(`直近 **${streak.length}回** の実行が続けて失敗しています。その間、新しい情報は入っていません。`);
    lines.push('公式サイト側の障害（503など）なら、戻れば自然に再開します。同じ失敗が続く場合は、');
    lines.push('公式ページの構成が変わっていないかを実行ログで確かめてください。');
    lines.push('');
    for (const run of streak) {
      if (run.current) lines.push('- いまの実行（このIssueを更新した実行）');
      else lines.push(`- ${formatJst(new Date(run.createdAt))}: ${run.url}`);
    }
    sections.push(lines.join('\n'));
  }

  if (keys.length === 0) return '';

  const out = [];
  out.push(`<!-- sync-stall-keys: ${keys.join(' ')} -->`);
  if (args.mention) {
    out.push(`@${args.mention} チケット情報の取り込みが滞っています。`);
    out.push('');
  }
  out.push(sections.join('\n\n'));
  out.push('');
  out.push('---');
  out.push('');
  out.push('この本文は `tools/report-sync-stall.js` が毎日作り直します。滞りが無くなれば、このIssueは自動で閉じます。');
  return `${out.join('\n')}\n`;
}

if (require.main === module) {
  try {
    process.stdout.write(report(parseArgs(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }
}

module.exports = { report, stalePr, failStreak, pendingSince };
