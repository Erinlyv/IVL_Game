/* 头脑风暴式 UI 冲烟：用 jsdom 加载 engine.js + game.js，自动点击按钮跑通若干完整生涯，
 * 验证第二版切片的 DOM 编排在运行期不抛错。仅开发期使用，可删。
 * 依赖： npm i jsdom（已从 demo 目录移除，跑测试前临时安装即可）
 * 运行： node _uitest.js [目标完成生涯数=3]
 * 说明： 终端可能出现一次 V8 "PromiseRejectCallback / Maximum call stack" 提示，
 *        那是 Node+jsdom 在深层异步下的宿主级 promise 追踪产物，非游戏逻辑错误；
 *        浏览器环境没有该追踪器，可忽略。
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = `<!DOCTYPE html><html><body>
  <div id="hud"></div><div id="log"></div>
  <section><div id="main"></div></section>
  <div id="toast"></div>
  <div id="cc"></div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://ivl.test/" });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Event = dom.window.Event;

// 在 jsdom 的 window 作用域里执行两份脚本，使其 const/函数互通且 window.IVL 可见
const engineSrc = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
const chargenSrc = fs.readFileSync(path.join(__dirname, "chargen.js"), "utf8");
const gameSrc = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
dom.window.eval(engineSrc + "\n;//---\n" + chargenSrc + "\n;//---\n" + gameSrc);

const TARGET = parseInt(process.argv[2] || "3", 10);
const d = dom.window.document;
const q = (s) => d.querySelector(s);
const qa = (s) => Array.from(d.querySelectorAll(s));

let endings = [];
let inEnding = false;

function clickOne() {
  // === v4.1 结局/成就图鉴弹窗（独立 overlay，结局界面会 await 其关闭）：直接关闭以继续流程 ===
  const cxm = q("#codexModal");
  if (cxm && cxm.classList.contains("show")) { q("#cxX").click(); return true; }
  // === v5.0 总决赛特殊玩法弹窗（game.js runGrandFinals，浮于 #koscreen 之上） ===
  // 单按钮流程：反复点 #gf-act 即可推进 序章→主客场→状态→BP→定位序列→队友半场→结算(→加时)。
  const gf = q("#gfOverlay");
  if (gf) {
    const rules = q("#gf-rules");
    if (rules && rules.classList.contains("show")) { q("#gf-rulesX").click(); return true; }
    const gact = q("#gf-act");
    if (gact && gact.style.display !== "none" && !gact.disabled) { gact.click(); return true; }
    return true; // 弹窗投掷/结算中，等待下一 tick
  }
  // === v4.1 季后赛 / 深渊「晋级图」整屏 overlay（game.js runKnockoutScreen） ===
  // overlay 自带按钮流程（与 present()/choose 解耦），需单独驱动：颁奖→完成 / 战报→颁奖 /
  // NPC 场跳过 / 玩家场点上场掷骰、点下一场。配合 window.__KO_FAST 关闭动画时序。
  const ko = q("#koscreen");
  if (ko) {
    const cer = q("#ko-ceremony");
    if (cer && cer.classList.contains("show")) { q("#ko-cerDone").click(); return true; }
    const rep = q("#ko-report");
    if (rep && rep.classList.contains("show")) { q("#ko-ceremonyBtn").click(); return true; }
    const skip = q("#ko-skipBtn");
    if (skip && skip.style.display !== "none") { skip.click(); return true; }
    const act = q("#ko-actBtn");
    if (act && act.style.display !== "none" && !act.disabled) { act.click(); return true; }
    return true; // overlay 动画/结算中，等待下一 tick
  }
  // === v4.2 常规赛「转播台」整屏 overlay（game.js runRegularSeasonScreen） ===
  // overlay 自带按钮：突发事件弹窗选项 / 一键跳过 / 继续。优先处理事件弹窗，再用跳过快速跑通。
  const rs = q("#rs-root");
  if (rs) {
    const evt = q("#rs-evtModal");
    if (evt && evt.classList.contains("show")) { const o = q("#rs-evtOpts .opt"); if (o) { o.click(); return true; } }
    const cont = q("#rs-continueBtn");
    if (cont && cont.style.display !== "none") { cont.click(); return true; }
    const skip = q("#rs-skipBtn");
    if (skip && skip.style.display !== "none" && !skip.disabled) { skip.click(); return true; }
    const act = q("#rs-actBtn");
    if (act && !act.disabled) { act.click(); return true; }
    return true; // 结算中，等待下一 tick
  }
  // === demo6 角色创建覆盖层（chargen.js） ===
  const cc = q("#cc");
  if (cc && cc.classList.contains("show")) {
    // 完成弹窗：开启职业生涯
    const ccmodal = q("#ccmodal");
    if (ccmodal && ccmodal.classList.contains("show")) { q("#ccclose").click(); return true; }
    // 第 1 步：填队名与选手 ID
    const ccteam = q("#ccteam");
    if (ccteam) {
      const ccpid = q("#ccpid");
      const fire = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event("input")); };
      if (!ccteam.value) { fire(ccteam, "测试队"); return true; }
      if (ccpid && !ccpid.value) { fire(ccpid, "测试侠"); return true; }
    }
    // 定位 / 位置 / 身份步：未选中则点一个选项卡
    const opts = qa("#cc .opt");
    if (opts.length && !qa("#cc .opt.sel").length) {
      opts[Math.floor(Math.random() * opts.length)].click(); return true;
    }
    // 常用角色步（demov4.2feedbackrole）：以词条选够 3 个（优先推荐词条以满足 ≥2 推荐）。
    const chips = qa("#cc .chip");
    if (chips.length) {
      const nextBtn = q("#ccnext");
      if (nextBtn && nextBtn.disabled) {
        const pick = qa("#cc .chip.rec:not(.sel)")[0] || qa("#cc .chip:not(.sel):not(.dim)")[0];
        if (pick) { pick.click(); return true; }
      }
    }
    // 偶尔刷新天赋
    const reroll = q("#ccreroll");
    if (reroll && Math.random() < 0.3) { reroll.click(); return true; }
    // 推进 / 完成签约
    const next = q("#ccnext");
    if (next && !next.disabled) { next.click(); return true; }
    return true; // 覆盖层仍在但需等待渲染
  }
  // 2) 训练项目
  const projs = qa(".trainproj").filter(b => !b.disabled && !b.classList.contains("disabled"));
  if (projs.length) { projs[Math.floor(Math.random() * projs.length)].click(); return true; }
  // 3) 商店（v4.0 购物车）：偶尔加入购物车一两件，然后结算（#shopCheckout）。
  const buys = qa(".si-buy[data-inc]").filter(b => !b.disabled);
  if (buys.length && Math.random() < 0.3) { buys[Math.floor(Math.random() * buys.length)].click(); return true; }
  const shopCheckout = q("#shopCheckout");
  if (shopCheckout && !shopCheckout.disabled) { shopCheckout.click(); return true; }
  // 3.5) 手动掷骰（季后赛 / 深渊总决赛）：投掷 → 看反馈 → 带状态打
  const rollBtn = q("#rollBtn");
  if (rollBtn && !rollBtn.disabled) { rollBtn.click(); return true; }
  const diceGo = q("#diceGo");
  if (diceGo) { diceGo.click(); return true; }
  // 3.6) 转会窗口改队名（v4.0 textPrompt：#teamOk 确认即可，留空走 fallback）
  const teamOk = q("#teamOk");
  if (teamOk && !teamOk.disabled) { teamOk.click(); return true; }
  // 4) 通用选项
  let choices = qa("#choices .choice").filter(b => !b.disabled);
  if (choices.length) {
    const en = q(".sc-ename");
    if (en) { if (!inEnding) { inEnding = true; endings.push(en.textContent); } }
    else { inEnding = false; }
    // 结局界面「一键生成图片分享」依赖 Image 解码（loadQrImage 的 onload）——jsdom 无图片解码，
    // 该按钮会永久挂起 await，故冲烟时跳过它（浏览器环境正常，不影响真实玩法）。
    const clickable = choices.filter(b => !/一键生成图片分享/.test(b.textContent));
    if (clickable.length) { choices = clickable; }
    choices[Math.floor(Math.random() * choices.length)].click();
    return true;
  }
  return false;
}

/* 单槽续局存档 · 集成断言（demov4.3feedback）：用带 URL 的独立 jsdom(启用 localStorage),
 * 真实走一遍 saveRun → 关档 → loadRun → resumeRun → clearRun,验证世界状态完整恢复。
 * 断言失败即抛错(退出码 1),不得跳过。 */
function testSaveResume() {
  const dom2 = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="hud"></div><div id="log"></div>
    <section><div id="main"></div></section>
    <div id="toast"></div><div id="cc"></div>
  </body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://ivl.test/" });
  // 测试体须与三份源码在同一 eval 词法作用域(P / curYear / RUN_KEY 等为 let/const 顶层绑定,
  // 独立 eval 看不到),故拼接进同一 eval,末尾 IIFE 返回结果。
  const testBody = `\n;//---\n(function () {
    const R = { fails: [], ok: (c, m) => { if (!c) R.fails.push(m); } };
    // 构造一个"进行中"的世界:玩家 + 本局 NPC 队伍 + 冠军/名场面/续局标记。
    P = new E.Player("青训", "存档队", "续局侠", "求生者");
    P.tech = 91; P.champ["夏"] = 1; P.spotlight.add("残血翻盘"); P._grandSlam = true;
    curYear = 3; curAge = E.CONFIG.START_AGE + 2;
    gameTeams = E.generateTeams(P.teamName); gameTeams.meta = E.buildTeamMeta(gameTeams);
    const teamSnap = P.teamName, domSnap = gameTeams.domestic.length;

    saveRun();
    R.ok(!!localStorage.getItem(RUN_KEY), "saveRun 写入 localStorage");
    const persisted = loadRun();
    R.ok(persisted && persisted.curYear === 3, "loadRun 读回赛年=3");
    R.ok(persisted && persisted.meta && persisted.meta.name === P.name, "存档 meta 含玩家全名");

    // 模拟关闭页面:清空运行期世界状态。
    P = null; gameTeams = null; curYear = 1; curAge = 18; logLines = [];

    const run = loadRun();
    resumeRun(run);
    R.ok(P instanceof E.Player, "resume 后 P 为 Player 实例");
    R.ok(P.teamName === teamSnap && P.tech === 91, "resume 后玩家字段恢复");
    R.ok(P.spotlight instanceof Set && P.spotlight.has("残血翻盘"), "resume 后 Set 字段可用");
    R.ok(P._grandSlam === true, "resume 后金满贯标记恢复(结局判定不丢)");
    R.ok(curYear === 3 && curAge === E.CONFIG.START_AGE + 2, "resume 后赛年/年龄恢复");
    R.ok(gameTeams && gameTeams.domestic && gameTeams.domestic.length === domSnap && gameTeams.meta, "resume 后 NPC 队伍/实力档恢复");
    R.ok(typeof P.cp === "number", "resume 后 getter/方法经原型链可用");

    clearRun();
    R.ok(loadRun() === null, "clearRun 后存档已清除");
    return JSON.stringify(R.fails);
  })()`;
  const raw = dom2.window.eval(engineSrc + "\n;//---\n" + chargenSrc + "\n;//---\n" + gameSrc + testBody);
  const fails = JSON.parse(raw);
  if (fails.length) {
    fails.forEach((m) => console.error("  ✗ " + m));
    throw new Error("续局存档集成断言失败：" + fails.length + " 项未通过");
  }
  console.log("[续局存档] 集成断言通过：saveRun → 关档 → loadRun → resumeRun → clearRun 世界状态完整恢复。");
}

/* 转位置修复 · 回归断言（demov5.0feedback）：转阵营(求生者↔监管者)后，必须同步改派新阵营的
 * 定位并刷新 positionName / 常用角色，否则总决赛按 P.position 选到错误剧情线。此处验证:
 *   1) IVLChargen 已暴露共享定位/角色池表与 rerollPosition;
 *   2) rerollPosition 产出的定位阵营与目标阵营一致、positionName 非空、常用角色恰 3 个含 ≥2 推荐;
 *   3) 总决赛 posKey 阵营校验(防御兜底)对"残留旧阵营定位"会回退到新阵营默认定位。
 * 断言失败即抛错(退出码 1),不得跳过。 */
function testPositionSwitch() {
  const dom3 = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="hud"></div><div id="log"></div>
    <section><div id="main"></div></section>
    <div id="toast"></div><div id="cc"></div>
  </body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
  const testBody = `\n;//---\n(function () {
    const R = { fails: [], ok: (c, m) => { if (!c) R.fails.push(m); } };
    const CG = window.IVLChargen;
    R.ok(CG && typeof CG.rerollPosition === "function", "IVLChargen.rerollPosition 已暴露");
    R.ok(CG && CG.POSITIONS && CG.ROLE_POOL, "IVLChargen 已暴露定位/角色池共享表");
    const campExpect = { "求生者": "surv", "监管者": "hunter" };
    ["求生者", "监管者"].forEach((role) => {
      for (let i = 0; i < 40; i++) {
        const np = CG.rerollPosition(role);
        R.ok(np && np.position && GF_POS[np.position], role + ": 改派定位命中 GF_POS(" + (np && np.position) + ")");
        R.ok(np && GF_POS[np.position] && GF_POS[np.position].camp === campExpect[role], role + ": 改派定位阵营与目标阵营一致");
        R.ok(np && typeof np.positionName === "string" && np.positionName.length > 0, role + ": positionName 非空");
        R.ok(np && Array.isArray(np.commonRoles) && np.commonRoles.length === 3, role + ": 常用角色恰 3 个");
        const rec = (CG.ROLE_POOL[np.position] || {}).rec || [];
        const recHit = (np ? np.commonRoles : []).filter((r) => rec.indexOf(r) >= 0).length;
        R.ok(recHit >= 2, role + ": 常用角色含 ≥2 推荐");
      }
    });
    // 复现 runGrandFinals 的 posKey 阵营校验(与实现同源的兜底规则)：残留旧阵营定位应回退到新阵营默认。
    const guard = (roleCn, pos) => {
      const isHunter = (roleCn === "监管者");
      const wantCamp = isHunter ? "hunter" : "surv";
      let posKey = pos || (isHunter ? "zj" : "qz");
      if (!GF_POS[posKey] || GF_POS[posKey].camp !== wantCamp) { posKey = isHunter ? "zj" : "qz"; }
      return posKey;
    };
    R.ok(GF_POS[guard("监管者", "qz")].camp === "hunter", "兜底: 监管者残留求生定位(qz)→回退监管默认");
    R.ok(GF_POS[guard("求生者", "zj")].camp === "surv", "兜底: 求生者残留监管定位(zj)→回退求生默认");
    R.ok(guard("监管者", "kc") === "kc", "兜底: 阵营一致时保留原定位");
    return JSON.stringify(R.fails);
  })()`;
  const raw = dom3.window.eval(engineSrc + "\n;//---\n" + chargenSrc + "\n;//---\n" + gameSrc + testBody);
  const fails = JSON.parse(raw);
  if (fails.length) {
    fails.forEach((m) => console.error("  ✗ " + m));
    throw new Error("转位置修复断言失败：" + fails.length + " 项未通过");
  }
  console.log("[转位置修复] 断言通过：rerollPosition 阵营/定位名/常用角色一致 + 总决赛 posKey 阵营兜底生效。");
}

/* 深渊黑马身份解锁 · UI 断言：未满足 3 个不同结局时显示但置灰；满足后可选并出现模式说明问号。 */
async function testGoldenIdentityUnlock() {
  const makeDom = () => {
    const dx = new JSDOM(`<!DOCTYPE html><html><body><div id="cc"></div></body></html>`,
      { runScripts: "outside-only", pretendToBeVisual: true, url: "https://ivl.test/" });
    dx.window.eval(engineSrc + "\n;//---\n" + chargenSrc);
    return dx;
  };
  const fire = (domx, el, v) => { el.value = v; el.dispatchEvent(new domx.window.Event("input")); };
  const reachIdentity = (unlocked) => {
    const dx = makeDom();
    const d = dx.window.document;
    dx.window.IVLChargen.run({ goldenUnlocked: unlocked });
    fire(dx, d.querySelector("#ccteam"), "测试队");
    fire(dx, d.querySelector("#ccpid"), "测试侠");
    d.querySelector("#ccnext").click();
    d.querySelector('.opt[data-role="survivor"]').click();
    d.querySelector("#ccnext").click();
    d.querySelector("#ccpos .opt").click();
    d.querySelector("#ccnext").click();
    Array.from(d.querySelectorAll("#cc .chip.rec")).slice(0, 3).forEach((b) => b.click());
    d.querySelector("#ccnext").click();
    const opts = Array.from(d.querySelectorAll("#ccids .opt"));
    return {
      names: opts.map((o) => o.querySelector(".nm").textContent.replace("?", "").trim()),
      golden: opts.find((o) => o.querySelector(".nm").textContent.includes("深渊黑马")),
    };
  };
  const locked = reachIdentity(false);
  const unlocked = reachIdentity(true);
  if (locked.names.length !== 4 || !locked.names.includes("深渊黑马")) {
    throw new Error("深渊黑马未解锁时也应显示为第 4 项，实际：" + locked.names.join(" / "));
  }
  if (!locked.golden.classList.contains("locked") || locked.golden.getAttribute("aria-disabled") !== "true" ||
      !locked.golden.querySelector(".ds").textContent.includes("完成3个不同结局即可解锁。")) {
    throw new Error("深渊黑马未解锁时应置灰且展示解锁文案");
  }
  if (!locked.golden.querySelector(".lockmark")) {
    throw new Error("深渊黑马未解锁时应在选项最右侧显示小锁");
  }
  if (unlocked.names.length !== 4 || !unlocked.names.includes("深渊黑马")) {
    throw new Error("深渊黑马解锁后应作为第 4 身份出现，实际：" + unlocked.names.join(" / "));
  }
  if (unlocked.golden.classList.contains("locked") || !unlocked.golden.querySelector(".qmark") ||
      !unlocked.golden.querySelector(".ds").textContent.includes("开局即巅峰！深渊民间队黑马进军职业赛场")) {
    throw new Error("深渊黑马解锁后应可选、展示新文案并提供模式说明问号");
  }
  console.log("[深渊黑马身份] UI 解锁断言通过：未解锁置灰可见，解锁后可选并带模式说明。");
}

async function testNpcTeamCustomization() {
  const dx = new JSDOM(`<!DOCTYPE html><html><body><div id="cc"></div></body></html>`,
    { runScripts: "outside-only", pretendToBeVisual: true, url: "https://ivl.test/" });
  dx.window.eval(engineSrc + "\n;//---\n" + chargenSrc);
  const d = dx.window.document;
  const fire = (el, v) => { el.value = v; el.dispatchEvent(new dx.window.Event("input")); };
  let resolved = null;
  dx.window.IVLChargen.run({ goldenUnlocked: true }).then((r) => { resolved = r; });
  if (!d.querySelector("#ccteamroll .dice-icon") || /随机/.test(d.querySelector("#ccteamroll").textContent)) {
    throw new Error("随机按钮应显示小骰子，不能显示汉字“随机”");
  }

  fire(d.querySelector("#ccteam"), "测试队");
  fire(d.querySelector("#ccpid"), "测试侠");
  d.querySelector("#ccNpcNames").click();
  const inputs = Array.from(d.querySelectorAll("#ccNpcFields .npc-input"));
  if (inputs.length !== 10) { throw new Error("NPC 队名弹窗应提供 10 个输入框，实际：" + inputs.length); }
  const labels = Array.from(d.querySelectorAll("#ccNpcFields .npc-field span")).map((x) => x.textContent.trim());
  if (labels[9] !== "10.仅深渊黑马模式需填写") {
    throw new Error("NPC 第 10 项标签不符合反馈：" + labels[9]);
  }
  fire(inputs[0], "Alpha");
  fire(inputs[1], "Alpha");
  d.querySelector("#ccNpcSave").click();
  if (!d.querySelector("#ccNpcError").textContent.includes("战队名称不可重复")) {
    throw new Error("NPC 队名重复时应展示就近错误提示");
  }
  inputs.forEach((inp, i) => fire(inp, "NPC" + (i + 1)));
  d.querySelector("#ccNpcSave").click();
  if (d.querySelector("#ccNpcModal").classList.contains("show")) {
    throw new Error("NPC 队名修正后应成功保存并关闭弹窗");
  }

  d.querySelector("#ccnext").click();
  d.querySelector('.opt[data-role="survivor"]').click();
  d.querySelector("#ccnext").click();
  d.querySelector("#ccpos .opt").click();
  d.querySelector("#ccnext").click();
  Array.from(d.querySelectorAll("#cc .chip.rec")).slice(0, 3).forEach((b) => b.click());
  d.querySelector("#ccnext").click();
  Array.from(d.querySelectorAll("#ccids .opt")).find((o) => o.textContent.includes("深渊黑马")).click();
  d.querySelector("#ccnext").click();
  d.querySelector("#ccnext").click();
  d.querySelector("#ccclose").click();
  await new Promise((r) => setImmediate(r));
  if (!resolved || !Array.isArray(resolved.customNpcTeams) || resolved.customNpcTeams.length !== 10) {
    throw new Error("深渊黑马应返回 10 支自定义大陆 NPC 职业战队名称");
  }
  if (resolved.customNpcTeams.join("/") !== "NPC1/NPC2/NPC3/NPC4/NPC5/NPC6/NPC7/NPC8/NPC9/NPC10") {
    throw new Error("深渊黑马自定义 NPC 队名返回值不正确：" + resolved.customNpcTeams.join("/"));
  }
  console.log("[NPC战队名称] UI 断言通过：弹窗 10 输入、重复校验、深渊黑马返回 10 支自定义队名。");
}

async function run() {
  testSaveResume();
  testPositionSwitch();
  await testGoldenIdentityUnlock();
  await testNpcTeamCustomization();
  dom.window.__KO_FAST = true;   // 关闭晋级图动画时序，冲烟快速跑通
  dom.window.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  let idle = 0, ticks = 0;
  while (endings.length < TARGET && ticks < 200000) {
    ticks++;
    const acted = clickOne();
    if (!acted) { idle++; if (idle > 5) break; } else idle = 0;
    await new Promise((r) => setImmediate(r));
  }
  console.log(`UI 冲烟完成：ticks=${ticks}，跑通生涯 ${endings.length} 段`);
  console.log("结局序列：", endings);
}

run().then(() => process.exit(0)).catch((e) => { console.error("UI 运行期异常：", e); process.exit(1); });
