<!-- sync-stall-keys: pr-stale fetch-fail -->
@example-owner チケット情報の取り込みが滞っています。

## 取り込みPRがマージされていません

最初の未マージ取り込みから **5日** たっています（2030-07-01 22:04 JST から）。
マージされるまで、`main` と本番のチケット情報は古いままです。

- 確認するPR: https://github.com/example/repo/pull/901

## 取り込みが続けて失敗しています

直近 **3回** の実行が続けて失敗しています。その間、新しい情報は入っていません。
公式サイト側の障害（503など）なら、戻れば自然に再開します。同じ失敗が続く場合は、
公式ページの構成が変わっていないかを実行ログで確かめてください。

- いまの実行（このIssueを更新した実行）
- 2030-07-05 22:00 JST: https://github.com/example/repo/actions/runs/4999
- 2030-07-04 22:00 JST: https://github.com/example/repo/actions/runs/4997

---

この本文は `tools/report-sync-stall.js` が毎日作り直します。滞りが無くなれば、このIssueは自動で閉じます。
