/* 专项冲烟：直接驱动 v4.1 季后赛 / 深渊「晋级图」整屏 KO 模块，验证
 *   buildSeasonSpec / buildAbyssSpec / koFinalize / koStandings / koReportHTML /
 *   koRunHeadless / koOverlayHTML 不抛错，名次推导覆盖全部席位，玩家路径真实结算可追溯。
 * 仅开发期使用，可删。运行：node _kotest.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = `<!DOCTYPE html><html><body>
  <div id="hud"></div><div id="log"></div>
  <section><div id="main"></div></section>
  <div id="toast"></div><div id="cc"></div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Event = dom.window.Event;

const read = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error("  ✗ " + msg); } else { console.log("  ✓ " + msg); } };

// 测试尾声：在同一 eval 作用域内驱动 KO 逻辑（P / gameTeams / build*Spec 均同作用域可见）。
const epilogue = `
  ;(function () {
    window.__KO = {};
    // 构造最小可用世界：玩家 P + 队伍池 gameTeams（均为 game.js 顶层 let，同作用域可写）。
    function freshWorld() {
      P = new Player("青训", "Nova", "Ace", "求生者");
      P.stamina = 90; P.stamina_max = 100; P.money = 1000; P.pop = 50;
      gameTeams = generateTeams("Nova");
      curYear = 2; curAge = 19;
    }
    // 纯模拟补满整张图 + 战报渲染（不打玩家场）。
    window.__KO.simulate = function (which, rank) {
      freshWorld();
      const spec = which === "abyss" ? buildAbyssSpec(rank) : buildSeasonSpec("夏", rank);
      koFinalize(spec);
      const st = koStandings(spec);
      const filled = st.filter((x) => x != null).length;
      const reportLen = koReportHTML(spec).length;
      const overlayLen = koOverlayHTML(spec).length;
      return { nodes: Object.keys(spec.nodes).length, standings: st.length, filled, finalWinner: spec.nodes[spec.finalKey].winner, reportLen, overlayLen, overlay: koOverlayHTML(spec) };
    };
    // 真实引擎驱动玩家路径（无 UI / 动画），返回名次与 F 列表。
    window.__KO.runHeadless = function (which, rank, winProb) {
      freshWorld();
      const spec = which === "abyss" ? buildAbyssSpec(rank) : buildSeasonSpec("夏", rank);
      const res = koRunHeadless(spec, winProb);
      return { place: res.place, fLen: res.fList.length, finalWinner: spec.nodes[spec.finalKey].winner, max: which === "abyss" ? 12 : 6 };
    };
  })();
`;

dom.window.eval(read("engine.js") + "\n;//--\n" + read("chargen.js") + "\n;//--\n" + read("game.js") + "\n;//--\n" + epilogue);

console.log("[纯模拟补满 + 战报 + overlay 骨架]");
for (const rank of [1, 2, 5, 6]) {
  const r = dom.window.__KO.simulate("season", rank);
  ok(r.finalWinner != null, `季后赛 rank=${rank} 总决赛产生冠军`);
  ok(r.filled === 6 && r.standings === 6, `季后赛 rank=${rank} 6 席名次全部填满 (filled=${r.filled})`);
  ok(r.reportLen > 100, `季后赛 rank=${rank} 战报 HTML 渲染 (${r.reportLen} 字符)`);
  ok(r.overlay.includes("ko-actBtn") && r.overlay.includes("ko-node-GF") && r.overlay.includes("ko-champName"), `季后赛 rank=${rank} overlay 含关键节点 id`);
}
for (const gr of [1, 2, 3]) {
  const r = dom.window.__KO.simulate("abyss", gr);
  ok(r.nodes === 12, `深渊 groupRank=${gr} 12 节点`);
  ok(r.finalWinner != null, `深渊 groupRank=${gr} 总决赛产生冠军`);
  ok(r.filled === 12 && r.standings === 12, `深渊 groupRank=${gr} 12 席名次全部填满 (filled=${r.filled})`);
  ok(r.reportLen > 100, `深渊 groupRank=${gr} 战报 HTML 渲染 (${r.reportLen} 字符)`);
  ok(r.overlay.includes("ko-node-M12") && r.overlay.includes("ko-node-M11") && r.overlay.includes("ko-cerDone"), `深渊 groupRank=${gr} overlay 含决赛/季军/颁奖 id`);
}

console.log("[真实引擎玩家路径 koRunHeadless]");
for (const [which, rank, prob, label] of [["season", 1, 0.9, "季后赛常胜"], ["season", 5, 0.1, "季后赛速败"], ["abyss", 1, 0.9, "深渊常胜"], ["abyss", 3, 0.1, "深渊速败"]]) {
  const r = dom.window.__KO.runHeadless(which, rank, prob);
  ok(r.place >= 1 && r.place <= r.max, `${label}：名次合法 (place=${r.place})`);
  ok(r.finalWinner != null, `${label}：晋级图最终补满`);
  ok(r.fLen >= 1, `${label}：至少打了 1 场 (F×${r.fLen})`);
}

console.log(failed === 0 ? "\nKO 专项冲烟全部通过。" : `\nKO 专项冲烟失败 ${failed} 项。`);
process.exit(failed === 0 ? 0 : 1);
