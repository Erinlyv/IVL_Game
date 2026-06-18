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

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
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
    // 第 2/3 步：未选中则点一个选项卡（定位 / 身份）
    const opts = qa("#cc .opt");
    if (opts.length && !qa("#cc .opt.sel").length) {
      opts[Math.floor(Math.random() * opts.length)].click(); return true;
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
  // 3) 商店：偶尔买一两件，然后结束
  const buys = qa(".si-buy").filter(b => !b.disabled);
  if (buys.length && Math.random() < 0.3) { buys[Math.floor(Math.random() * buys.length)].click(); return true; }
  const shopDone = q("#shopDone");
  if (shopDone) { shopDone.click(); return true; }
  // 3.5) 手动掷骰（季后赛 / 深渊总决赛）：投掷 → 看反馈 → 带状态打
  const rollBtn = q("#rollBtn");
  if (rollBtn && !rollBtn.disabled) { rollBtn.click(); return true; }
  const diceGo = q("#diceGo");
  if (diceGo) { diceGo.click(); return true; }
  // 4) 通用选项
  const choices = qa("#choices .choice").filter(b => !b.disabled);
  if (choices.length) {
    const en = q(".ending-name");
    if (en) { if (!inEnding) { inEnding = true; endings.push(en.textContent); } }
    else { inEnding = false; }
    choices[Math.floor(Math.random() * choices.length)].click();
    return true;
  }
  return false;
}

async function run() {
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
