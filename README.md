# IVL_Game

《第五人格 · 职业电竞选手生涯模拟》游戏本体仓库。

`main` 分支始终指向最新版本（当前 = v3.0）。每个历史 demo 版本都保留为一条独立的存档分支，便于回溯与对比。

## 分支说明

| 分支 | 说明 |
|---|---|
| `main` | 最新开发线（当前等同 v3.0 + 本 README） |
| `v3.0` | v3.0 存档（最新版本快照） |
| `v2.3` | v2.3 存档 |
| `v2.2` | v2.2 存档 |
| `v2.1` | v2.1 存档：新增角色生成 chargen |
| `v2.0` | v2.0 存档：引入 UI 测试脚本 |
| `v1.0` | v1.0 存档：初始可玩切片 |

历史为线性提交：`v1.0 → v2.0 → v2.1 → v2.2 → v2.3 → v3.0`，各存档分支分别指向对应提交。

## 本地运行

```bash
git checkout main   # 或任意版本分支，如 git checkout v2.1
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 文件结构

| 文件 | 说明 |
|---|---|
| `index.html` | 入口页面 |
| `engine.js` | 游戏引擎/状态机 |
| `game.js` | 玩法逻辑与剧情驱动 |
| `chargen.js` / `chargen.css` | 角色生成（v2.1+） |
| `styles.css` | 样式 |
| `_smoketest.js` / `_uitest.js` | 冒烟/UI 自测脚本 |
