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

IVL 模拟器是一款以《第五人格》职业电竞为背景的**生涯模拟**网页游戏。玩家从角色创建开始,经历训练、比赛、剧情抉择,体验一名职业选手的成长生涯。当前为可玩垂直切片(vertical slice),纯前端实现,运行时零依赖、即开即玩。

## ✨ 特性

- **角色生成(chargen)**:开局自定义选手档案,选择阵营 / 定位(求生 牵制·救人·ob·辅助 / 监管 追击·控场·守椅)与常用角色
- **生涯事件流**:7 赛年的训练 / 比赛 / 转会 / 突发事件(宠物·版本变更·队内训练等)驱动的状态机玩法
- **深渊黑马模式**:解锁后可从民间队深渊出道,招募队友、喊话、签约职业队并触发专属剧情线
- **赛事系统**:常规赛 / 季后赛 / IVS / 深渊,含 KO 晋级图与**冠亚决赛特殊玩法**(D120 掷骰、按定位分支)
- **结局与成就**:分级成就(白金 / 黄金 / 白银 / 青铜)、可截图分享的生涯战报卡、本地存档续局
- **HUD 数值面板 + 事件流水**:实时反馈成长与抉择结果
- **纯静态前端**:原生 HTML / CSS / JavaScript,无构建步骤、无运行时依赖

## 🗂️ 版本与分支

`main` 始终指向最新版本(当前 = **v6.1**)。正式版本打 `release` tag(`v4.1` / `v4.2` / `v5.0` / `v5.0.1` / `v5.1` / `v5.2` / `v6.0` / `v6.1`),早期 demo 版本另存为独立存档分支便于回溯与对比。

| 版本 | 类型 | 说明 |
|---|---|---|
| `v6.1` | tag | **当前版本**:优化深渊黑马体验，新增 NPC 战队常用方案、旧友羁绊确认剧情与 KO 后悔药重打 |
| `v6.0` | tag | 新增深渊黑马模式、民间队深渊开局、专属剧情/成就与黑马成长波动 |
| `v5.2` | tag | 常规赛改为 10 队真实单循环后台结算,同步训练/商店/移动端体验优化 |
| `v5.1` | tag | 新增 8 件赛事名场面,覆盖求生/监管、胜负、加赛、淘汰赛与常用角色触发条件;冒烟断言覆盖新增名场面 |
| `v5.0.1` | tag | 位置变更后阵营/定位/常用角色池同步修复,并为冠亚决赛异常阵营兜底 |
| `v5.0` | tag | 角色定位 / 常用角色、自由转会、宠物 / 版本变更等突发事件、冠亚决赛特殊玩法、队友成长重做、世界第一系成就、文案定稿 |
| `v4.2` | tag | 移动端适配 + 一键生成战报分享图 + 训练体能修复 |
| `v4.1` | tag / 分支 | 启动页 / KO 晋级图 / FMVP 颁奖 / 生涯战报卡二维码 / 声明页 |
| `v3.0` | 分支 | 生涯战报卡 + 全成就一览 + 本地存档 |
| `v2.3` | 分支 | 玩法与数值迭代 |
| `v2.2` | 分支 | chargen 与玩法迭代 |
| `v2.1` | 分支 | 新增角色生成 chargen |
| `v2.0` | 分支 | 引入 UI 测试脚本 |
| `v1.0` | 分支 | 初始可玩切片 |

切换任意版本试玩:`git checkout v6.1`(tag)或 `git checkout v2.1`(分支),再本地起服务器。

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
| `_smoketest.js` / `_uitest.js` / `_kotest.js` / `_gftest.js` | 冒烟 / UI / KO 晋级图 / 冠亚决赛自测脚本 |
| `_strategyplay.js` | 本地攻略实测脚本(手动运行,不作为 CI 门禁) |
| `qr-ivlgame.png` | 生涯战报卡二维码(指向在线试玩) |
| `package.json` / `package-lock.json` | 测试期 Node 依赖与本地/CI 脚本 |
| `.github/workflows/ci.yml` | CI:Node 下跑四套门禁脚本(冒烟 / UI / KO/后悔药 / 冠亚决赛),不跑 `_strategyplay.js` |
| `.nojekyll` | 跳过 Jekyll,按原样发布静态文件 |

## ✅ 本地测试

```bash
npm ci
npm test

# 可选:攻略/策略实测,耗时随样本数增加;不作为 CI 门禁
node _strategyplay.js 5
```

## 🚀 部署

GitHub Pages 以 `main` 分支根目录为源(`.nojekyll` 跳过 Jekyll,原样发布)。推送到 `main` 后,Pages 自动重新构建并上线,无需额外操作。

## 📄 许可

[MIT](LICENSE) © Erinlyv
