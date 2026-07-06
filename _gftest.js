/* 临时定向冲烟：直接驱动 runGrandFinals 弹窗，验证 7 个定位（求生 4 + 监管 3）
 * 均能从序章跑到解算并 resolve，且返回结构合法。运行：node _gftest.js（跑完可删）。 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = `<!DOCTYPE html><html><body>
  <div id="hud"></div><div id="log"></div>
  <section><div id="main"></div></section><div id="toast"></div><div id="cc"></div>
</body></html>`;
const { VirtualConsole } = require("jsdom");
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => console.error("JSDOM ERR:", (e && e.detail && (e.detail.stack || e.detail.message)) || e));
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.Event = dom.window.Event;

const read = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");

const epilogue = `
;(function(){
  window.__KO_FAST = true;
  window.__gfRun = function(role, pos){
    P = new Player("青训","测试队","测试侠", role);
    P.position = pos; P.tech=82; P.tac=78; P.phys=74; P.stab=76; P.stamina=60; P.stamina_max=100;
    curYear = 3; curAge = 20;
    gameTeams = generateTeams("测试队");
    return runGrandFinals({ youName:"测试队", oppName:"劲敌", kind:"深渊" });
  };
  // 集成路径：驱动真实 runKnockoutScreen，强制玩家非总决赛场必胜以走到「冠亚决赛」拦截点，
  // 验证 startGrandFinals 被触发（spec._finalsFmvp 落值）+ 冠军时 FMVP 归属沿用弹窗解算。
  window.__gfIntegration = function(role, pos){
    P = new Player("青训","Nova","Ace", role);
    P.position = pos; P.tech=82; P.tac=78; P.phys=74; P.stab=76; P.stamina=90; P.stamina_max=100; P.money=1000; P.pop=50;
    gameTeams = generateTeams("Nova");
    curYear = 2; curAge = 19;
    const _orig = koDecidePlayer;
    koDecidePlayer = function(spec, key, r, wo){ if (key === spec.finalKey) { return _orig(spec, key, r, wo); } return { win:true, reason:"强制晋级" }; };
    const spec = buildSeasonSpec("夏", 1);
    return runKnockoutScreen(spec).then(function(r){
      koDecidePlayer = _orig;
      return { place: r.place, finalsFmvp: spec._finalsFmvp, reward: spec._reward };
    });
  };
})();
`;

try {
  dom.window.eval(read("engine.js") + "\n;//--\n" + read("chargen.js") + "\n;//--\n" + read("game.js") + "\n;//--\n" + epilogue);
} catch (e) { console.error("EVAL THREW:", e && e.stack || e); process.exit(2); }
console.log("loaded; typeof __gfRun =", typeof dom.window.__gfRun);

const cases = [["求生者","qz"],["求生者","jr"],["求生者","ob"],["求生者","fz"],["监管者","zj"],["监管者","kc"],["监管者","sy"]];
// demov5.0feedback·转位置修复(防御兜底)：阵营与定位不符（老档 / 转位置后残留旧定位）时，
// runGrandFinals 的 posKey 阵营校验应回退到新阵营默认定位，仍能从序章跑到解算而不串线/崩溃。
const mismatchCases = [["监管者","qz"],["监管者","jr"],["求生者","zj"],["求生者","sy"]];
let failed = 0;

async function driveOne(role, pos) {
  let p;
  try { p = dom.window.__gfRun(role, pos); }
  catch (e) { failed++; console.error(`  ✗ __gfRun(${role},${pos}) threw:`, e && e.stack || e); return; }
  console.log(`  · started ${role}/${pos}, overlay=${!!dom.window.document.getElementById("gfOverlay")}`);
  // 反复点 gf-act 直到 overlay 消失（resolve）
  let guard = 0;
  while (dom.window.document.getElementById("gfOverlay") && guard < 4000) {
    guard++;
    const b = dom.window.document.getElementById("gf-act");
    const rules = dom.window.document.getElementById("gf-rules");
    if (rules && rules.classList.contains("show")) { dom.window.document.getElementById("gf-rulesX").click(); }
    else if (b && b.style.display !== "none" && !b.disabled) b.click();
    await new Promise((r) => setImmediate(r));
  }
  const res = await p;
  const you = res ? res.myScore[0] + res.allyScore[0] : -1, opp = res ? res.myScore[1] + res.allyScore[1] : -1;
  // 非加时局：win 必须与总比分一致（加时局总比分持平，胜负由加时决定，跳过该断言）
  const scoreConsistent = !res ? false : (you === opp) ? true : (res.win === (you > opp));
  const ok = res && typeof res.win === "boolean" && Array.isArray(res.myScore) && Array.isArray(res.allyScore)
    && typeof res.fmvpIsPlayer === "boolean" && guard < 4000 && scoreConsistent;
  if (!ok) { failed++; console.error(`  ✗ ${role}/${pos} guard=${guard} res=${JSON.stringify(res)}`); }
  else console.log(`  ✓ ${role}/${pos} → win=${res.win} my=${res.myScore} ally=${res.allyScore} fmvpYou=${res.fmvpIsPlayer} (clicks=${guard})`);
}

async function driveIntegration(role, pos) {
  const d = dom.window.document;
  let p;
  try { p = dom.window.__gfIntegration(role, pos); }
  catch (e) { failed++; console.error(`  ✗ integration(${role},${pos}) threw:`, e && e.stack || e); return; }
  let guard = 0, sawGf = false;
  while (guard < 12000) {
    guard++;
    const gf = d.getElementById("gfOverlay");
    if (gf) {
      sawGf = true;
      const rules = d.getElementById("gf-rules");
      if (rules && rules.classList.contains("show")) { d.getElementById("gf-rulesX").click(); }
      else { const b = d.getElementById("gf-act"); if (b && b.style.display !== "none" && !b.disabled) b.click(); }
      await new Promise((r) => setImmediate(r)); continue;
    }
    const ko = d.getElementById("koscreen");
    if (!ko) break; // teardown → promise resolved
    const cer = d.getElementById("ko-ceremony");
    if (cer && cer.classList.contains("show")) { d.getElementById("ko-cerDone").click(); await new Promise((r) => setImmediate(r)); continue; }
    const rep = d.getElementById("ko-report");
    if (rep && rep.classList.contains("show")) { d.getElementById("ko-ceremonyBtn").click(); await new Promise((r) => setImmediate(r)); continue; }
    const skip = d.getElementById("ko-skipBtn");
    if (skip && skip.style.display !== "none") { skip.click(); await new Promise((r) => setImmediate(r)); continue; }
    const act = d.getElementById("ko-actBtn");
    if (act && act.style.display !== "none" && !act.disabled) { act.click(); await new Promise((r) => setImmediate(r)); continue; }
    await new Promise((r) => setImmediate(r));
  }
  const r = await p;
  const placeOk = r && (r.place === 1 || r.place === 2);
  const interceptOk = sawGf && (r.finalsFmvp === true || r.finalsFmvp === false); // 拦截点确实触发且落值
  const fmvpOk = (r.place !== 1) || (r.reward && r.reward.fmvp === r.finalsFmvp); // 冠军时 FMVP 归属沿用弹窗解算
  const rewardOk = r && r.reward && r.reward.place === r.place;
  if (placeOk && interceptOk && fmvpOk && rewardOk) {
    console.log(`  ✓ 集成 ${role}/${pos} → place=${r.place} finalsFmvp=${r.finalsFmvp} rewardFmvp=${r.reward.fmvp} (clicks=${guard})`);
  } else {
    failed++; console.error(`  ✗ 集成 ${role}/${pos} guard=${guard} sawGf=${sawGf} r=${JSON.stringify(r)}`);
  }
}

(async () => {
  // 每个定位跑 6 次，覆盖随机分支 + 加时路径
  for (const [role, pos] of cases) {
    for (let i = 0; i < 6; i++) { await driveOne(role, pos); }
  }
  console.log("\n[转位置兜底：阵营与定位不符时应回退新阵营默认定位]");
  for (const [role, pos] of mismatchCases) {
    for (let i = 0; i < 3; i++) { await driveOne(role, pos); }
  }
  console.log("\n[集成：真实 runKnockoutScreen 拦截冠亚决赛]");
  for (const [role, pos] of [["求生者","qz"],["监管者","zj"]]) {
    for (let i = 0; i < 3; i++) { await driveIntegration(role, pos); }
  }
  console.log(failed === 0 ? "\n总决赛弹窗定向冲烟全部通过。" : `\n失败 ${failed} 项。`);
  process.exit(failed === 0 ? 0 : 1);
})();
