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
    window.__KO.runRedoOverlay = async function () {
      freshWorld();
      window.__KO_FAST = true;
      P.tech = 1; P.tac = 1; P.phys = 1; P.stab = 1; P.pop = 0; P.stamina = 100; P.stamina_max = 100;
      P.redo_token = 1; P.used_redo = false; P.nextGameBuff = 0; P.nextNoBadRoll = false;
      const spec = buildSeasonSpec("夏", 5);
      const firstPlayerKey = spec.order.find((key) => spec.nodes[key].slots.includes(spec.playerKey));
      const waitTick = () => new Promise((r) => setTimeout(r, 0));
      runKnockoutScreen(spec);
      let redoShown = false;
      for (let i = 0; i < 120; i++) {
        const redo = document.getElementById("ko-redo");
        if (redo && redo.classList.contains("show")) { redoShown = true; break; }
        const skip = document.getElementById("ko-skipBtn");
        const act = document.getElementById("ko-actBtn");
        if (skip && skip.style.display !== "none" && !skip.disabled) skip.click();
        else if (act && act.style.display !== "none" && !act.disabled) act.click();
        await waitTick(); await waitTick();
      }
      const unresolvedAtPrompt = firstPlayerKey && spec.nodes[firstPlayerKey].winner === null;
      const fListAtPrompt = spec._fList.length;
      const yes = document.getElementById("ko-redoYes");
      if (yes) yes.click();
      await Promise.resolve();
      const tokenAfter = P.redo_token;
      const usedRedo = P.used_redo;
      const fListAfterRestore = spec._fList.length;
      const unresolvedAfterClick = firstPlayerKey && spec.nodes[firstPlayerKey].winner === null;
      for (let i = 0; i < 80 && firstPlayerKey && spec.nodes[firstPlayerKey].winner === null; i++) await waitTick();
      const resolvedAfterRetry = firstPlayerKey && spec.nodes[firstPlayerKey].winner !== null;
      const overlay = document.getElementById("koscreen"); if (overlay) overlay.remove();
      window.__KO_FAST = false;
      return { redoShown, unresolvedAtPrompt, fListAtPrompt, tokenAfter, usedRedo, fListAfterRestore, unresolvedAfterClick, resolvedAfterRetry };
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

(async () => {
  console.log("[KO 后悔药重打]");
  const rr = await dom.window.__KO.runRedoOverlay();
  ok(rr.redoShown, "玩家 KO 场失败后弹出后悔药重打确认");
  ok(rr.unresolvedAtPrompt && rr.fListAtPrompt === 1, "后悔药确认出现时晋级图尚未写入胜负，首轮 F 已暂记");
  ok(rr.tokenAfter === 0 && rr.usedRedo, "点击重打后消耗 1 次额度并记录使用过后悔药");
  ok(rr.fListAfterRestore === 0 && rr.unresolvedAfterClick, "点击重打后回滚本场 F 与节点状态，仍停留同一场");
  ok(rr.resolvedAfterRetry, "重打后同一场会重新结算并写入晋级图");

  console.log(failed === 0 ? "\nKO 专项冲烟全部通过。" : `\nKO 专项冲烟失败 ${failed} 项。`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
