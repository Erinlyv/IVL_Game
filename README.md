<div align="center">

# IVL_Game · IVL 模拟器

**《第五人格 · 职业电竞选手生涯模拟》—— 可玩垂直切片**

[![Play](https://img.shields.io/badge/▶_在线试玩-Live_Demo-2ea44f?style=for-the-badge)](https://erinlyv.github.io/IVL_Game/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## 🎮 在线试玩

直接在浏览器打开,无需安装:

### 👉 https://erinlyv.github.io/IVL_Game/

> 由 GitHub Pages 自动构建,`main` 分支每次更新后约 1–2 分钟即同步上线。

## 关于

IVL 模拟器是一款以《第五人格》职业电竞为背景的**生涯模拟**网页游戏。玩家从角色创建开始,经历训练、比赛、剧情抉择,体验一名职业选手的成长生涯。当前为可玩垂直切片(vertical slice),纯前端实现,零依赖、即开即玩。

## ✨ 特性

- **角色生成(chargen)**:开局自定义选手档案
- **生涯事件流**:训练 / 比赛 / 剧情节点驱动的状态机玩法
- **HUD 数值面板 + 事件流水**:实时反馈成长与抉择结果
- **纯静态前端**:原生 HTML / CSS / JavaScript,无构建步骤、无运行时依赖

## 🗂️ 版本与分支

`main` 始终指向最新版本(当前 = v4.1)。每个历史 demo 版本都保留为独立的存档分支,便于回溯与对比。历史为线性提交:`v1.0 → v2.0 → v2.1 → v2.2 → v2.3 → v3.0 → v4.1`。正式版本同时打 `release` tag(如 `v4.1`)。

| 分支 | 说明 |
|---|---|
| `main` | 最新开发线(当前等同 v4.1) |
| `v4.1` | 最新版本快照(启动页 / KO 晋级图 / FMVP 颁奖 / 生涯战报卡二维码 / 声明页) |
| `v3.0` | 生涯战报卡 + 全成就一览 + 本地存档 |
| `v2.3` | 玩法与数值迭代 |
| `v2.2` | chargen 与玩法迭代 |
| `v2.1` | 新增角色生成 chargen |
| `v2.0` | 引入 UI 测试脚本 |
| `v1.0` | 初始可玩切片 |

切换任意版本试玩:`git checkout v2.1`(再本地起服务器)。

## 💻 本地运行

任意静态服务器即可:

```bash
git clone https://github.com/Erinlyv/IVL_Game.git
cd IVL_Game
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 📁 文件结构

| 文件 | 说明 |
|---|---|
| `index.html` | 入口页面 |
| `engine.js` | 游戏引擎 / 状态机 |
| `game.js` | 玩法逻辑与剧情驱动 |
| `chargen.js` / `chargen.css` | 角色生成(v2.1+) |
| `styles.css` | 全局样式 |
| `_smoketest.js` / `_uitest.js` / `_kotest.js` | 冒烟 / UI / KO 晋级图自测脚本 |
| `qr-ivlgame.png` | 生涯战报卡二维码(指向在线试玩) |
| `.github/workflows/ci.yml` | CI:Node 下跑三套自测脚本 |
| `.nojekyll` | 跳过 Jekyll,按原样发布静态文件 |

## 🚀 部署

GitHub Pages 以 `main` 分支根目录为源(`.nojekyll` 跳过 Jekyll,原样发布)。推送到 `main` 后,Pages 自动重新构建并上线,无需额外操作。

## 📄 许可

[MIT](LICENSE) © Erinlyv
