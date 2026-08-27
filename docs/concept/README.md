# docs/concept

企画・調査の元資料（HTML）を、受け取った状態のまま保管します。

| ファイル | 内容 | 正本となる文書 |
| --- | --- | --- |
| `supporter-timeline-design.html` | SANGA SUPPORTER TIMELINE 全体設計 | `docs/supporter-timeline-design.md` |
| `fan-tools-research.html` | 世界の非公式スポーツファンツール調査 | `docs/fan-tools-research.md` |
| `timeline-architecture.html` | SUPPORTER TIMELINE の構成図（5枚） | `docs/supporter-timeline-design.md`、`docs/news-extraction-research.md` |

## 扱い方

- 内容の正本は上表のMarkdownです。仕様や方針を確認するときはMarkdownを読みます。
- ここのHTMLは閲覧用の元資料です。内容が変わった場合はMarkdown側を更新し、HTMLは差し替えるか、そのまま当時の資料として残します。
- 公開ページではありません。`public/` へ配置せず、本番ページからリンクしません。
- 外部CDNに依存させません。`timeline-architecture.html` はWebフォントを読み込まず、端末のフォントで表示します。
