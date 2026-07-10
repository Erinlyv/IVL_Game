/* 按「越早夺冠、冠军越多」攻略逻辑，用 jsdom 驱动真实 engine.js + game.js 自动打若干完整生涯。
 * 这是"我照着攻略自己打一遍"的可复现实验：决策严格对齐攻略——
 *   身份=榜前人皇；天赋重刷至技术+战术尽量高；商店优先好运签/属性成长/护腕/体检/庄园密信；
 *   训练优先单练(技术)→团队训练(战术)→缺体力则休息，能高强度就高强度；
 *   季后赛/深渊冠亚决赛前用好运签；不主动转会(冲一人一城)；拒绝各种半途特殊结局。
 * 运行： node _strategyplay.js [生涯数=200] [随机种子可选]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const N = parseInt(process.argv[2] || "200", 10);

const html = `<!DOCTYPE html><html><body>
  <div id="hud"></div><div id="log"></div>
  <section><div id="main"></div></section>
  <div id="toast"></div>
  <div id="cc"></div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://ivl.local/" });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Event = dom.window.Event;
dom.window.__KO_FAST = true;                 // 关闭晋级图/总决赛动画时序，便于快速无头驱动

const engineSrc = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
const chargenSrc = fs.readFileSync(path.join(__dirname, "chargen.js"), "utf8");
const gameSrc = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
dom.window.eval(engineSrc + "\n;//---\n" + chargenSrc + "\n;//---\n" + gameSrc);

// 捕获玩家实例（P 是 game.js 词法作用域内的 let，取不到；包裹构造器把实例挂到 __P）
dom.window.eval(`(function(){
  const Orig = window.IVL.Player;
  function Wrapped(){ const p = new Orig(...arguments); window.__P = p; return p; }
  Wrapped.prototype = Orig.prototype;
  window.IVL.Player = Wrapped;
})();`);

const d = dom.window.document;
const q = (s) => d.querySelector(s);
const qa = (s) => Array.from(d.querySelectorAll(s));
const txt = (el) => (el ? el.textContent.trim() : "");

// ---------- 攻略决策器 ----------
const TALENT_ATTEMPTS = 30;          // 天赋重刷上限
let talentTries = 0;
let luckyUsedKey = null;             // 本场是否已用过好运签（按 KO 节点 key 记）

// 攻略（用户指定）：早期抢体力道具(筋膜枪/柠檬水) + 全程高强度训练；
// 晚期(第4赛年起)训练涨不动了，改抢属性商品(技术/战术/心态书，免衰减)拉属性。
// 护腕/理疗常备保命；好运签留给冠亚决赛；庄园密信冲金满贯。
function shopPriority() {
  const yr = (dom.window.__P && dom.window.__P.cur_year) || 1;
  // 保命核心(每年必先买)：理疗清腱鞘炎(拖过下一年末=伤重退役) + 护腕/体检降伤概率。
  // 高强度训练会抬高受伤概率，保命层不能省。
  const survive = ["理疗康复套餐", "护腕", "经纪团队体检"];
  if (yr <= 3) {
    // 早期：保命 → 战术攻略(战术+5：既拉 cp 又加速队友成长，抬高决赛胜率上限) → 好运签(留决赛)
    //      → 体力道具(撑满全程高强度) → 技术攻略。
    return [...survive, "顶尖退役选手的复盘机会", "好运签", "筋膜枪", "柠檬水", "榜前绝活玩家的单练机会"];
  }
  // 晚期：训练涨不动了，改抢免衰减的属性商品；保命 + 好运签常备，少量体力续航。
  return [...survive, "好运签", "顶尖退役选手的复盘机会", "榜前绝活玩家的单练机会",
    "《好心态决定电竞选手的一生》", "私人陪练", "筋膜枪", "庄园密信", "后悔药", "骨龄逆转血清"];
}
const SHOP_CAP = {
  "柠檬水": 5, "筋膜枪": 3, "护腕": 1, "经纪团队体检": 1, "理疗康复套餐": 2, "好运签": 2,
  "榜前绝活玩家的单练机会": 2, "顶尖退役选手的复盘机会": 2, "《好心态决定电竞选手的一生》": 2, "私人陪练": 1,
};

const HI_COST = 22 * 1.2;             // 高强度单练/团队训练体力消耗 ≈ 26.4
function trainingActive() { return qa(".trainproj").length > 0; }
function needStamina() {
  const P = dom.window.__P;
  return !!(P && trainingActive() && P.stamina < HI_COST + 0.5);
}
// 受伤先用理疗清伤(防「伤重退役」)；训练中体力不足则嗑体力道具(筋膜枪优先，续得久)，维持"全程高强度训练"。
// 直接调用游戏全局 useItem(消耗背包 + 生效 + 刷新训练面板)，比点开背包 UI 快得多。
function useBagIfNeeded() {
  const P = dom.window.__P; if (!P || typeof dom.window.useItem !== "function") return false;
  if ((P.teno_active || P.temp_active) && (P.inv["理疗康复套餐"] || 0) > 0) {
    dom.window.useItem("理疗康复套餐"); return true;
  }
  if (needStamina()) {
    const potion = (P.inv["筋膜枪"] || 0) > 0 ? "筋膜枪" : ((P.inv["柠檬水"] || 0) > 0 ? "柠檬水" : null);
    if (potion) { dom.window.useItem(potion); return true; }
  }
  return false;
}

function setIntensity(name) {
  const b = qa(".intbtn").find((x) => x.dataset.int === name);
  if (b && !b.classList.contains("on")) { b.click(); return true; }
  return false;
}

function trainingPick() {
  const P = dom.window.__P;
  const proj = (n) => qa(".trainproj").find((b) => b.dataset.proj === n && !b.disabled && !b.classList.contains("disabled"));
  // 全程高强度（体力靠道具续，见 useBagIfNeeded）
  if (setIntensity("高强度")) return true;
  const tech = P ? P.tech : 0, tac = P ? P.tac : 0;
  const want = tech < 80 ? "单练" : (tac < 85 ? "团队训练" : "直播排位");
  let b = proj(want) || proj("单练") || proj("团队训练");
  if (b) { b.click(); return true; }
  // 体力不足且无道具可嗑 → 直播排位(消耗最低，顺带来钱)；再不行才休息
  b = proj("直播排位") || proj("休息");
  if (b) { b.click(); return true; }
  return false;
}

function shopStep() {
  // 找到最高优先、且当前有可点(加入购物车/＋)按钮的商品，点一次；否则结算。
  const rows = qa(".shoprow");
  for (const name of shopPriority()) {
    for (const row of rows) {
      if (txt(row.querySelector(".si-name")).includes(name)) {
        const add = row.querySelector(".si-buy[data-inc]:not([disabled])") || row.querySelector(".si-pl[data-inc]:not([disabled])");
        // 属性/护腕/体检等只买 1；好运签买满库存；消耗品买 1
        if (add) {
          const stepper = row.querySelector(".si-step");
          const curQ = stepper ? parseInt(txt(row.querySelector(".si-q")) || "0", 10) : 0;
          const capOne = ["护腕", "经纪团队体检", "榜前绝活玩家的单练机会", "顶尖退役选手的复盘机会",
            "私人陪练", "运动营养师", "《好心态决定电竞选手的一生》", "庄园密信", "后悔药", "骨龄逆转血清"];
          const cap = SHOP_CAP[name] || (capOne.some((c) => name.includes(c)) ? 1 : 2);
          if (curQ < cap) { add.click(); return true; }
        }
      }
    }
  }
  const co = q("#shopCheckout");
  if (co && !co.disabled) { co.click(); return true; }
  return false;
}

function chargenStep() {
  const cc = q("#cc");
  if (!(cc && cc.classList.contains("show"))) return false;
  const ccmodal = q("#ccmodal");
  if (ccmodal && ccmodal.classList.contains("show")) { q("#ccclose").click(); return true; }
  // step0 建档
  const ccteam = q("#ccteam");
  if (ccteam) {
    const ccpid = q("#ccpid");
    const fire = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event("input")); };
    if (!ccteam.value) { fire(ccteam, "Nova"); return true; }
    if (ccpid && !ccpid.value) { fire(ccpid, "Ace"); return true; }
    const nx = q("#ccnext"); if (nx && !nx.disabled) { nx.click(); return true; }
  }
  // 阵营（.opt[data-role]）→ 选求生者
  if (q("#cccontent .opt[data-role]")) {
    if (!q("#cccontent .opt.sel")) { const s = q('.opt[data-role="survivor"]'); if (s) { s.click(); return true; } }
    const nx = q("#ccnext"); if (nx && !nx.disabled) { nx.click(); return true; }
  }
  // 身份（#ccids）→ 榜前人皇 = 第 3 个
  if (q("#ccids")) {
    if (!q("#ccids .opt.sel")) { const opts = qa("#ccids .opt"); (opts[2] || opts[opts.length - 1]).click(); return true; }
    const nx = q("#ccnext"); if (nx && !nx.disabled) { nx.click(); return true; }
  }
  // 天赋（#ccattrs）→ 重刷到技术+战术够高
  if (q("#ccattrs")) {
    const vals = qa("#ccattrs .attr .vv").map((e) => parseInt(txt(e), 10) || 0);
    const [tech, tac] = vals;
    const good = tech >= 55 && tac >= 42;
    if (!good && talentTries < TALENT_ATTEMPTS) { talentTries++; q("#ccreroll").click(); return true; }
    const nx = q("#ccnext"); if (nx && !nx.disabled) { nx.click(); return true; }
  }
  // 常用角色（.chip）→ 先推荐凑够 3
  const chips = qa("#cc .chip");
  if (chips.length) {
    const nx = q("#ccnext");
    if (nx && nx.disabled) {
      const pick = qa("#cc .chip.rec:not(.sel)")[0] || qa("#cc .chip:not(.sel):not(.dim)")[0];
      if (pick) { pick.click(); return true; }
    }
  }
  // 位置（#ccpos 或其他 .opt）→ 选第一个
  const opts = qa("#cc .opt");
  if (opts.length && !qa("#cc .opt.sel").length) { opts[0].click(); return true; }
  const next = q("#ccnext");
  if (next && !next.disabled) { next.click(); return true; }
  return true;
}

function koStep() {
  const ko = q("#koscreen");
  if (!ko) return false;
  const cer = q("#ko-ceremony");
  if (cer && cer.classList.contains("show")) { q("#ko-cerDone").click(); return true; }
  const rep = q("#ko-report");
  if (rep && rep.classList.contains("show")) { q("#ko-ceremonyBtn").click(); return true; }
  // 背包已打开：用好运签后关闭
  const bag = q("#ko-bag");
  if (bag && bag.classList.contains("show")) {
    const use = qa("#ko-bag .bagx-use").find((b) => b.dataset.n === "好运签" && !b.disabled);
    if (use) { use.click(); }
    const x = q("#ko-bagX"); if (x) x.click();
    return true;
  }
  const ks = dom.window.__koScreen;
  // 玩家在场、ready 阶段用好运签。关键：给决赛(finalKey)留一支——决赛对手最强、又是夺冠分水岭。
  // 非决赛轮只有在库存≥2(留 1 给决赛)时才嗑；决赛则只要有就嗑。
  try {
    if (ks && ks.phase === "ready" && ks.isPlayerMatch()) {
      const key = ks.spec.order[ks.idx];
      const P = dom.window.__P;
      const have = P ? (P.inv["好运签"] || 0) : 0;
      const isFinal = key === ks.spec.finalKey;
      if (have > 0 && luckyUsedKey !== key && (isFinal || have >= 2)) {
        luckyUsedKey = key;
        const bb = q("#ko-bagBtn"); if (bb) { bb.click(); return true; }
      }
    }
  } catch (e) {}
  const roll = q("#ko-rollBtn") || q("#rollBtn");
  if (roll && !roll.disabled && roll.offsetParent !== undefined) { roll.click(); return true; }
  const skip = q("#ko-skipBtn");
  if (skip && skip.style.display !== "none") { skip.click(); return true; }
  const act = q("#ko-actBtn");
  if (act && act.style.display !== "none" && !act.disabled) { act.click(); return true; }
  return true;
}

function clickOne() {
  // 结局图鉴弹窗
  const cxm = q("#codexModal");
  if (cxm && cxm.classList.contains("show")) { q("#cxX").click(); return true; }
  // 总决赛特殊玩法
  const gf = q("#gfOverlay");
  if (gf) {
    const rules = q("#gf-rules");
    if (rules && rules.classList.contains("show")) { q("#gf-rulesX").click(); return true; }
    const gact = q("#gf-act");
    if (gact && gact.style.display !== "none" && !gact.disabled) { gact.click(); return true; }
    return true;
  }
  if (koStep()) return true;
  // 非比赛覆盖层期间：受伤用理疗清伤(防「伤重退役」) / 训练缺体力嗑体力道具(维持高强度)
  if (!q("#rs-root") && !q("#gfOverlay") && !q("#koscreen")) { if (useBagIfNeeded()) return true; }
  // 常规赛整屏
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
    return true;
  }
  if (chargenStep()) return true;
  // 训练
  if (qa(".trainproj").length) { if (trainingPick()) return true; }
  // 商店
  if (qa(".shoprow").length || q("#shopCheckout")) { if (shopStep()) return true; }
  // 手动掷骰（兜底）
  const rollBtn = q("#rollBtn"); if (rollBtn && !rollBtn.disabled) { rollBtn.click(); return true; }
  const diceGo = q("#diceGo"); if (diceGo) { diceGo.click(); return true; }
  // 转会改名兜底
  const teamOk = q("#teamOk"); if (teamOk && !teamOk.disabled) { teamOk.click(); return true; }
  // 通用选项：拒绝转会/特殊结局，冲一人一城；否则选 primary
  let choices = qa("#choices .choice").filter((b) => !b.disabled);
  if (choices.length) {
    const clickable = choices.filter((b) => !/一键生成图片分享/.test(b.textContent));
    if (clickable.length) choices = clickable;
    const decline = choices.find((b) => /更喜欢赛场|不再提示|留队|舍不得|留下/.test(b.textContent));
    if (decline) { decline.click(); return true; }
    const prim = choices.find((b) => b.classList.contains("primary"));
    (prim || choices[0]).click();
    return true;
  }
  return false;
}

// ---------- 主循环：跑 N 个生涯，采集战绩 ----------
const careers = [];
let recordedFor = -1;   // 已记录到 careers.length 时对应的 __P，避免重复记录

function snapshotCareer() {
  const P = dom.window.__P;
  if (!P) return null;
  const ename = txt(q(".sc-ename")) || null;
  return {
    firstChampYear: P.first_champ_year,
    champ: { ...P.champ },
    total: P.totalChamp,
    fmvp: P.fmvp_total,
    perYear: { ...P.champ_per_year },
    grandSlam: !!P._grandSlam,
    ending: ename,
    pop: Math.round(P.pop),
    tech: Math.round(P.tech), tac: Math.round(P.tac),
    phys: Math.round(P.phys), stab: Math.round(P.stab),
    cp: Math.round(P.cp), money: Math.round(P.money),
    starter: !!P.is_starter, playoffs: P.playoff_count,
    runnerups: P.runnerups, thirds: P.thirds,
    teamNpc: Math.round(P.teamNpc(7)), transfers: P.transfer_count,
    identity: P.identity,
  };
}

async function main() {
  dom.window.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  let idle = 0, ticks = 0, lastEndingSeen = false;
  const MAX_TICKS = N * 8000 + 40000;
  while (careers.length < N && ticks < MAX_TICKS) {
    ticks++;
    const inEnding = d.body.classList.contains("settle-mode") && !!q(".sc-ename");
    if (inEnding && !lastEndingSeen) {
      const snap = snapshotCareer();
      if (snap) careers.push(snap);
      lastEndingSeen = true;
    }
    if (!inEnding) lastEndingSeen = false;

    let acted = false;
    try { acted = clickOne(); } catch (e) { acted = false; }
    if (inEnding) {
      const again = qa("#choices .choice").find((b) => /再来一局/.test(b.textContent));
      if (again) { again.click(); talentTries = 0; luckyUsedKey = null; acted = true; }
    }
    if (!acted) { idle++; if (idle > 200) break; } else idle = 0;
    await new Promise((r) => setImmediate(r));
  }
  report();
}

// ---------- 统计输出 ----------
function report() {
function pct(x) { return (100 * x / careers.length).toFixed(1) + "%"; }
const n = careers.length;
const sum = (f) => careers.reduce((a, c) => a + f(c), 0);
const cnt = (f) => careers.filter(f).length;

const firstYears = careers.map((c) => c.firstChampYear).filter((y) => y != null);
const avgFirst = firstYears.length ? (firstYears.reduce((a, b) => a + b, 0) / firstYears.length).toFixed(2) : "—";
const dist = {};
for (let y = 1; y <= 7; y++) dist[y] = cnt((c) => c.firstChampYear === y);
const neverChamp = cnt((c) => c.firstChampYear == null);

console.log("========================================================");
console.log(`IVL demo-v5.0 · 攻略实测（人皇/堆技战术/好运签/不转会） · ${n} 个完整生涯`);
console.log("========================================================");
console.log(`拿到过冠军的生涯占比       : ${pct(cnt((c) => c.total > 0))}  (${cnt((c) => c.total > 0)}/${n})`);
console.log(`首冠平均出现赛年           : 第 ${avgFirst} 年`);
console.log(`首冠年份分布               :`);
for (let y = 1; y <= 7; y++) console.log(`   第 ${y} 年首冠           : ${pct(dist[y])}  (${dist[y]})`);
console.log(`   生涯零冠               : ${pct(neverChamp)}  (${neverChamp})`);
console.log("--------------------------------------------------------");
console.log(`第 1 年就夺冠           : ${pct(dist[1])}`);
console.log(`前 2 年内夺冠           : ${pct(dist[1] + dist[2])}`);
console.log(`前 3 年内夺冠           : ${pct(dist[1] + dist[2] + dist[3])}`);
console.log("--------------------------------------------------------");
console.log(`人均冠军总数           : ${(sum((c) => c.total) / n).toFixed(2)} 座`);
console.log(`  · 夏季赛             : ${(sum((c) => c.champ["夏"]) / n).toFixed(2)}`);
console.log(`  · 秋季赛             : ${(sum((c) => c.champ["秋"]) / n).toFixed(2)}`);
console.log(`  · IVS               : ${(sum((c) => c.champ["IVS"]) / n).toFixed(2)}`);
console.log(`  · 深渊              : ${(sum((c) => c.champ["深渊"]) / n).toFixed(2)}`);
console.log(`人均 FMVP             : ${(sum((c) => c.fmvp) / n).toFixed(2)}`);
console.log(`金满贯(同年四冠)生涯占比 : ${pct(cnt((c) => c.grandSlam))}`);
console.log(`5 冠以上(含)生涯占比    : ${pct(cnt((c) => c.total >= 5))}`);
console.log("--------------------------------------------------------");
const endings = {};
careers.forEach((c) => { if (c.ending) endings[c.ending] = (endings[c.ending] || 0) + 1; });
console.log("结局分布：");
Object.entries(endings).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k.padEnd(8)} : ${pct(v)} (${v})`));

// 打印前 3 个生涯的逐年夺冠明细，作为"实况样本"
console.log("--------------------------------------------------------");
console.log("样本生涯（逐年冠军数明细）：");
careers.slice(0, 8).forEach((c, i) => {
  const yrs = Object.keys(c.perYear).sort().map((y) => `Y${y}:${c.perYear[y]}冠`).join(" ");
  console.log(`  #${i + 1} [${c.identity}] 首冠第${c.firstChampYear || "—"}年 · 总${c.total}冠(夏${c.champ["夏"]}/秋${c.champ["秋"]}/IVS${c.champ["IVS"]}/深渊${c.champ["深渊"]}) · 亚${c.runnerups}季${c.thirds} · FMVP${c.fmvp} · ${c.ending || "?"}`);
  console.log(`       终值 技${c.tech}/战${c.tac}/体${c.phys}/稳${c.stab} cp${c.cp} · 队友${c.teamNpc} · 人气${c.pop} · 钱${c.money} · 首发${c.starter} · 进季后${c.playoffs} · 转会${c.transfers} · [${yrs}]`);
  });
  console.log(`\n(实际完成生涯数：${n}/${N})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("运行期异常：", e); process.exit(1); });
