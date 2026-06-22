/* =============================================================================
 * IVL 模拟器 · 交互编排 + UI (game.js) · 垂直可玩切片 demo-v3.0
 * 把已回归引擎(engine.js)的"自动决策"换成玩家点击：角色创建 → 7 赛年
 * (赛季目标面板 / 训练 / 突发事件 / 商店 / 季后赛 / IVS / 深渊含季军赛 /
 *  转会 / 年度评选 / 商业休整) → 结局成就。
 *
 * v3.0 新增（对齐《策划案 v7.0》/《数值设计 v6.0》/《文案设计 v2.0》《demov2.3feedback》）：
 *   · 冠军同年同步疲劳重做（每多 1 冠 −2/场、封顶 −6）；庄园密信改「减免所有冠军疲劳」；
 *   · 容貌驱动商业类训练事件触发概率（pickTrainingEvent 加权抽取，商业休整年再 ×2.5）；
 *   · 对手基准区间重校（常规 33/60·45/74、IVS [60,84]、深渊总决 [65,85]）；
 *   · 训练事件 23 件 + 赛事名场面 5 件（赛后按发挥小概率触发，纯叙事彩蛋）；
 *   · 季后赛进入按钮文案：「进入双败季后赛」→「进入季后赛」；
 *   · 生涯战报卡（可截图分享 / 复制文案）、全部结局与成就一览、localStorage 本地存档。
 *
 * v2.2 新增（对齐《策划案 v6.4》/《数值设计 v5.3》/《文案设计 v1.2》）：
 *   · 商店刷新：常驻基础 + 9 抽 5 常规 + 8% 命中稀缺抽 1（后悔药 / 庄园密信 / 骨龄逆转血清）；
 *   · 比赛随机浮动改玩家手动掷骰（仅季后赛 / 深渊总决赛），6 档发挥反馈，区间 / 分布不变；
 *   · 后悔药重打 / 庄园密信抵消同步疲劳 / 血清抹平年龄衰减；
 *   · 商业休整门槛收紧（容貌>60 且 赛年≥4）；生涯回顾称号修复（监管者→屠皇）。
 *
 * 依据《demo v2.3 feedback》整改：
 *   ① 运气为隐藏数值，对局全程不显示 / 不提及，仅在生涯落幕的结局界面揭晓本轮运气值（v6.5 调整）；
 *   ② 全部前台文案严格对齐《文案设计 v1.1》（身份介绍 / 选拔 / 目标面板 /
 *      转会 / 赛事旁白 / 赛后因果 / FMVP 颁奖词 / 商业休整 / 伤病预警 /
 *      突发状况 / 商店标签 / 年度评选 / 结局成就，结局界面成就仅列名称）；
 *   ③ 角色创建按《策划案 v6.3》§四：先输入队伍名称、再输入选手 ID，
 *      完整选手 ID = 队伍名称_玩家ID（如 MRC_XiaoD）；转会后可重新输入队名。
 * feedback15 沿用：突发事件初始选项不显示数值，选完才公布结果。
 * ===========================================================================*/
const E = window.IVL;
const $ = (sel) => document.querySelector(sel);

/* 称号显示口径（v6.4 / v1.2 修复）：严格按定位取值——求生者→「人皇」、监管者→「屠皇」，
 * 不再出现"监管者在生涯回顾中被误显示为人皇"的串号 bug。 */
function kingTitle(role) { return role === "监管者" ? "屠皇" : "人皇"; }
// 生涯回顾 / 结局界面的身份短名：榜前身份按定位取人皇/屠皇，其余按引擎身份原样。
function idShort(p) { return p.identity === "人皇" ? kingTitle(p.role) : p.identity; }

let P = null;
let curYear = 1, curAge = 18;
let curStage = "—";
let logLines = [];

/* ============================ UI 基础原语 ============================== */
const main = () => $("#main");
function setStage(s) { curStage = s; renderHUD(); }

function present({ title, sub, body, choices }) {
  return new Promise((resolve) => {
    const m = main();
    m.innerHTML = `
      <div class="panel-head">
        <h2>${title || ""}</h2>
        ${sub ? `<p class="sub">${sub}</p>` : ""}
      </div>
      <div class="panel-body">${body || ""}</div>
      <div class="choices" id="choices"></div>`;
    const box = $("#choices");
    (choices || []).forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "choice " + (c.cls || "");
      b.disabled = !!c.disabled;
      b.innerHTML = `<span class="cl">${c.label}</span>${c.hint ? `<span class="ch">${c.hint}</span>` : ""}`;
      if (!c.disabled) b.onclick = () => resolve(i);
      box.appendChild(b);
    });
    m.scrollTop = 0;
  });
}
async function say(title, body, cont = "继续", sub) {
  await present({ title, sub, body, choices: [{ label: cont, cls: "primary" }] });
}
async function choose(title, body, choices, sub) { return present({ title, sub, body, choices }); }

function pushLog(text, cls = "") {
  logLines.unshift({ text, cls, t: `Y${curYear}` });
  if (logLines.length > 80) logLines.pop();
  renderLog();
}
function renderLog() {
  const el = $("#log");
  if (!el) return;
  el.innerHTML = logLines.map(l => `<div class="logline ${l.cls}"><span class="tag">${l.t}</span>${l.text}</div>`).join("");
}

/* ------------------------------- HUD ----------------------------------- */
function bar(label, val, color) {
  const v = Math.max(0, Math.min(100, val));
  return `<div class="stat">
    <div class="stat-top"><span>${label}</span><b>${val.toFixed(0)}</b></div>
    <div class="track"><i style="width:${v}%;background:${color}"></i></div>
  </div>`;
}
function renderHUD() {
  const h = $("#hud");
  if (!h) return;
  if (!P) { h.innerHTML = ""; return; }
  const stMax = P.stamina_max;
  const stPct = Math.max(0, Math.min(100, (P.stamina / stMax) * 100));
  const stColor = P.stamina < 20 ? "#f47272" : (P.stamina < 30 ? "#e8a24b" : "#4ade80");
  const champs = `夏${P.champ["夏"]} 秋${P.champ["秋"]} IVS${P.champ["IVS"]} 深渊${P.champ["深渊"]}`;
  const debuffs = [];
  if (P.negative_news) debuffs.push(`<span class="db">负面新闻</span>`);
  if (P.teno_active) debuffs.push(`<span class="db">腱鞘炎</span>`);
  if (P.temp_active) debuffs.push(`<span class="db">临时伤病</span>`);
  if (P.rest_active) debuffs.push(`<span class="db rest">商业休整</span>`);
  if (P.has_wrist) debuffs.push(`<span class="db buff">护腕</span>`);
  if (P.has_checkup) debuffs.push(`<span class="db buff">体检</span>`);
  if (P.redo_token > 0) debuffs.push(`<span class="db rare">后悔药×${P.redo_token}</span>`);
  if (P.has_seal) debuffs.push(`<span class="db rare">庄园密信</span>`);
  if (P.serum_active) debuffs.push(`<span class="db rare">逆龄血清</span>`);
  if (P.nextGameBuff) debuffs.push(`<span class="db buff">下场F+${P.nextGameBuff.toFixed(0)}</span>`);
  if (P.nextNoBadRoll) debuffs.push(`<span class="db buff">🎴下场不失常</span>`);

  h.innerHTML = `
    <div class="hud-id">
      <div class="avatar">${(P.name || "?").slice(0, 1)}</div>
      <div>
        <div class="pname">${P.name} <span class="pos">${P.role}${P.identity === "人皇" ? "·" + kingTitle(P.role) : ""}</span></div>
        <div class="pmeta">${idShort(P)} · ${curAge}岁 · 赛年 ${curYear}/7</div>
        <div class="pstage">阶段：${curStage}</div>
      </div>
    </div>
    <div class="stamina">
      <div class="stat-top"><span>体力</span><b>${P.stamina.toFixed(0)} / ${stMax.toFixed(0)}</b></div>
      <div class="track big"><i style="width:${stPct}%;background:${stColor}"></i></div>
    </div>
    <div class="stats">
      ${bar("技术", P.tech, "#f5cf6a")}
      ${bar("战术", P.tac, "#6ea8fe")}
      ${bar("体能", P.phys, "#4ade80")}
      ${bar("稳定", P.stab, "#c4a3f0")}
      ${bar("容貌", P.appearance, "#f0a6c0")}
    </div>
    <div class="res">
      <div class="resitem"><span>人气</span><b>${P.pop.toFixed(1)} 万</b></div>
      <div class="resitem"><span>资金</span><b>${P.money.toFixed(0)} G</b></div>
      <div class="resitem"><span>主力</span><b>${P.is_starter ? "✔ 首发" : "替补"}</b></div>
      <div class="resitem"><span>进季后</span><b>${P.playoff_count}</b></div>
    </div>
    <div class="champs">🏆 ${champs} ｜ FMVP ${P.fmvp_total} ｜ 亚${P.runnerups} 季${P.thirds}</div>
    ${debuffs.length ? `<div class="debuffs">${debuffs.join("")}</div>` : ""}
    <div class="inv" id="inv"></div>`;
  renderInventory();
}

const INV_META = {
  "柠檬水": { slot: "stam", val: 30, label: "🥤体力+30" },
  "筋膜枪": { slot: "stam", val: 60, label: "🔫体力+60" },
  "好运签": { slot: "fbuff", val: 8, noBadRoll: true, label: "🎴下场F+8·不失常" },
  "定制应援物料": { slot: "fbuff", val: 5, pop: 0.5, label: "📣下场F+5" },
  "战术分析仪": { slot: "fbuff", val: 6, label: "📊下场F+6" },
  "理疗康复套餐": { slot: "heal", label: "💊清伤病" },
};
function renderInventory() {
  const el = $("#inv");
  if (!el) return;
  const items = Object.entries(P.inv || {}).filter(([, n]) => n > 0);
  if (!items.length) { el.innerHTML = `<div class="inv-empty">背包空（可在商店采购消耗品）</div>`; return; }
  el.innerHTML = `<div class="inv-title">背包（随时可用）</div>` +
    items.map(([name, n]) => `<button class="invbtn" data-item="${name}">${INV_META[name].label} ×${n}</button>`).join("");
  el.querySelectorAll(".invbtn").forEach(b => { b.onclick = () => useItem(b.dataset.item); });
}
function useItem(name) {
  if (!P.inv || P.inv[name] <= 0) return;
  const m = INV_META[name];
  if (m.slot === "stam") {
    if (P.stamina >= P.stamina_max - 0.01) { flash("体力已满，无需补给"); return; }
    P.stamina = Math.min(P.stamina_max, P.stamina + m.val);
    flash(`使用${name}：体力 +${m.val}`);
  } else if (m.slot === "fbuff") {
    P.nextGameBuff += m.val;
    if (m.pop) P.addPop(m.pop);
    if (m.noBadRoll) P.nextNoBadRoll = true;   // 好运签：下一场临场发挥不会失常
    flash(`使用${name}：下一场 F +${m.val}${m.noBadRoll ? "、临场不会失常" : ""}${m.pop ? "、人气+" + m.pop : ""}`);
  } else if (m.slot === "heal") {
    if (!P.teno_active && !P.temp_active) { flash("当前没有伤病可清除"); return; }
    E.healInjury(P);
    flash(`使用${name}：清除伤病 debuff`);
  }
  P.inv[name] -= 1;
  renderHUD();
}
let flashTimer = null;
function flash(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ============================ 角色创建 ================================= */
// 初始身份介绍语严格取自《文案设计 v1.1》第一章；人皇/屠皇随定位变化。
const IDENTITY_INTRO = {
  "青训": "你是俱乐部青训营里摸爬滚打出来的苗子。没有耀眼的天赋，但每一项都不差，教练说你「底子干净」。",
  "主播": "出道前你已是圈内小有名气的主播，自带话题与粉丝。镜头感是你的天赋，争议也是。",
  "人皇": "段位榜前几页，常年挂着你的 ID。出神入化的遛鬼技术，让战队直接把邀请送到了你面前。",
  "屠皇": "段位榜前几页，常年挂着你的 ID。手中的多个断层S1角色，让战队亲自找上了门。",
};
const IDENTITY_NAME = { "青训": "青训选手", "主播": "人气主播", "人皇": "榜前人皇", "屠皇": "榜前屠皇" };
const IDENTITY_EFFECT = {
  "青训": "开局首个训练周期 +2 次训练机会",
  "主播": "初始人气、资金较高；首年队内选拔获扶持",
  "人皇": "初始技术较高",
  "屠皇": "初始技术较高",
};

function textPrompt({ step, sub, inputId, btnId, placeholder, fallback, maxlen = 12, preview }) {
  return new Promise((resolve) => {
    main().innerHTML = `
      <div class="panel-head"><h2>创建角色 · 第 ${step} 步</h2><p class="sub">${sub}</p></div>
      <div class="panel-body">
        <input id="${inputId}" class="text-input" maxlength="${maxlen}" placeholder="${placeholder}" />
        ${preview ? `<div class="idpreview" id="idpreview"></div>` : ""}
      </div>
      <div class="choices"><button class="choice primary" id="${btnId}"><span class="cl">下一步</span></button></div>`;
    const inp = $("#" + inputId); inp.focus();
    if (preview) {
      const pv = $("#idpreview");
      const upd = () => { pv.innerHTML = `完整选手 ID：<b>${preview((inp.value || fallback).trim() || fallback)}</b>`; };
      upd(); inp.oninput = upd;
    }
    const go = () => resolve((inp.value || fallback).trim() || fallback);
    $("#" + btnId).onclick = go;
    inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
}

async function characterCreation() {
  // 角色创建界面完全照搬 demo6「俱乐部签约」四步流程（chargen.js / chargen.css）：
  // 建档 → 定位 → 身份 → 天赋检定 → 签约完成弹窗。数值仍由引擎 E.Player 生成。
  const { player } = await window.IVLChargen.run();
  P = player;
  curYear = 1; curAge = 18;
  renderHUD();
  pushLog(`${P.name} 出道，定位${P.role}。`, "good");
}

function rollCardHtml(t) {
  const row = (k, v, c) => `<div class="rollrow"><span>${k}</span><div class="rolltrack"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div><b>${v.toFixed(0)}</b></div>`;
  return `<div class="rollcard">
    ${row("技术", t.tech, "#f5cf6a")}
    ${row("战术", t.tac, "#6ea8fe")}
    ${row("体能", t.phys, "#4ade80")}
    ${row("稳定", t.stab, "#c4a3f0")}
    ${row("容貌", t.appearance, "#f0a6c0")}
    <div class="rollmeta">资金 ${t.money.toFixed(0)} G · 人气 ${t.pop.toFixed(0)} 万 · 体力上限 ${t.stamina_max.toFixed(0)}</div>
  </div>`;
}

/* ====================== 赛季目标面板 + 伤病风险预警 ===================== */
// 纯展示层(策划 §15 / feedback15)：竞技 / 养成 / 风险 三类推荐目标。
// 伤病风险预警文案严格取自《文案设计 v1.1》第九章。
function injuryRiskLine() {
  const tp = E.tenoProb(P, curAge);
  if (P.teno_active) {
    return { level: "high", text: "诊断结果没有变：腱鞘炎还在。医生说得很直接——「若到下赛年末仍不理疗，你的职业生涯可能就此画上句号。」" };
  }
  if (tp >= 0.08) return { level: "mid", text: "你最近总在结束训练后甩手腕——身体在用最直白的方式提醒你：该添护腕或者安排理疗了。" };
  return null;
}
// 赛季目标面板提示语严格取自《文案设计 v1.1》第三章（教练/经理口吻）。
function seasonGoals() {
  const goals = [];
  const ATTR_NAME = { tech: "技术", tac: "战术", phys: "体能", stab: "稳定性" };
  // 竞技目标（按 CP 分档）
  const cp = P.cp;
  let comp;
  if (!P.is_starter) comp = "教练拍了拍你：「先在轮换里站稳，争取这赛季打进一次季后赛。」";
  else if (cp < 55) comp = "教练拍了拍你：「先在轮换里站稳，争取这赛季打进一次季后赛。」";
  else if (cp < 70) comp = "这赛季的目标很明确——打进夏 / 秋季赛季后赛，让所有人记住你的名字。";
  else if (cp < 82) comp = "你已经够强了。冲国内冠军，顺手把 IVS 的门票（夏季赛前 2）拿下。";
  else comp = "经理在战术板上写下两个字：深渊。这一年，向小组出线乃至世界冠军发起冲击。";
  goals.push(["竞技", comp]);
  // 养成目标（指向当前最短板）
  const attrs = [["tech", P.tech], ["tac", P.tac], ["phys", P.phys], ["stab", P.stab]];
  attrs.sort((a, b) => a[1] - b[1]);
  const lag = ATTR_NAME[attrs[0][0]];
  let grow;
  if (attrs[0][1] < 60) grow = `复盘会上结论很统一：你的「${lag}」明显拖后腿，这赛季先补到 60 以上。`;
  else if (attrs[0][1] < 80) grow = `想和强队主力掰手腕，把「${lag}」补到 80 是这一年的功课。`;
  else grow = "框架已经成型，剩下的是细节——用道具和机会把核心项推上 90+。";
  goals.push(["养成", grow]);
  // 风险目标（按优先级，文案取自 §3.3）
  let risk;
  if (P.teno_active) risk = "队医的脸色很难看：「先去理疗。伤重退役的倒计时，已经开始了。」";
  else if (E.tenoProb(P, curAge) >= 0.08) risk = "体检报告递到你手上：手腕负担正在累积，该添副护腕、或者安排一次理疗了。";
  else if (P.phys < 50) risk = "体能教练提醒你：续航是你的短板，备点柠檬水和筋膜枪，别在长赛程里掉链子。";
  else if (P.negative_news) risk = "公关那边来了消息：舆论还没散，要不要让俱乐部公关帮你处理一下？";
  else risk = "队医比了个 OK：身体状态健康，保持节奏就好。";
  goals.push(["风险", risk]);
  return goals;
}
async function seasonGoalPanel() {
  setStage("赛季目标");
  if (curYear === 1 && !P.is_starter) return; // 出道首年直接进流程，避免信息过载
  const gs = seasonGoals();
  const tagCls = { "竞技": "g-comp", "养成": "g-grow", "风险": "g-risk" };
  const cards = gs.map(([t, txt]) => `<div class="goal ${tagCls[t]}"><span class="goal-t">${t}目标</span><p>${txt}</p></div>`).join("");
  const risk = injuryRiskLine();
  await say(`赛年 ${curYear} · 赛季目标面板`, `
    <p class="sub2">每个赛年的三类推荐目标——不强制，只为你指路。</p>
    <div class="goals">${cards}</div>
    ${risk && risk.level === "high" ? `<div class="riskbar ko">⚠ 伤病风险预警：${risk.text}</div>` : ""}`,
    "进入商店");
}

/* ============================ 训练周期 ================================ */
const TRAIN_INFO = {
  "单练": "技术+2 体能+1（−22体力）",
  "团队训练": "战术+2 技术+1（−22体力）",
  "体能训练": "体能+2 稳定+1（−18体力）",
  "直播排位": "稳定+2 战术+1 人气+0.5（−15体力）",
  "休息": "体力 +50",
};
let curIntensity = "正常";

function trainProjsHtml() {
  return Object.keys(E.CONFIG.TRAIN).map(proj => {
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[curIntensity][1];
    const need = proj !== "休息" && P.stamina < cost;
    return `<button class="trainproj ${need ? "disabled" : ""}" data-proj="${proj}" ${need ? "disabled" : ""}>
      <span class="tp-name">${proj}</span><span class="tp-info">${TRAIN_INFO[proj]}</span>
      ${need ? `<span class="tp-need">体力不足</span>` : ""}</button>`;
  }).join("");
}
function trainBody() {
  return `
    <div class="intensity">强度：
      ${["休养", "正常", "高强度"].map(i => `<button class="intbtn ${i === curIntensity ? "on" : ""}" data-int="${i}">${i}</button>`).join("")}
      <span class="int-hint">效果/消耗 ×${E.CONFIG.INTENSITY[curIntensity][0]}${P.rest_active ? " ·休整收益×0.8" : ""}</span></div>
    <div class="trainprojs">${trainProjsHtml()}</div>`;
}
function trainingTurn(turn, total) {
  return new Promise((resolve) => {
    main().innerHTML = `
      <div class="panel-head"><h2>训练 · 第 ${turn}/${total} 次</h2>
        <p class="sub">选择本次训练的强度与项目。</p></div>
      <div class="panel-body">${trainBody()}</div>`;
    const rebind = () => {
      main().querySelectorAll(".intbtn").forEach(b => { b.onclick = () => { curIntensity = b.dataset.int; main().querySelector(".panel-body").innerHTML = trainBody(); rebind(); }; });
      main().querySelectorAll(".trainproj:not(.disabled)").forEach(b => { b.onclick = () => resolve({ proj: b.dataset.proj, intensity: curIntensity }); });
    };
    rebind();
  });
}

async function trainingPeriod(n, periodLabel) {
  setStage(periodLabel);
  P.stamina = P.stamina_max;
  P.inj_train_mult = 1.0;
  renderHUD();                 // 进入新训练周期立即把恢复后的体力同步到看板（demov2.1feedback2）
  let trained = false;
  for (let i = 1; i <= n; i++) {
    const before = snapshotAttrs();
    let { proj, intensity } = await trainingTurn(i, n);
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[intensity][1];
    if (proj !== "休息" && P.stamina < cost) { proj = "休息"; intensity = "正常"; }
    E.applyTraining(P, proj, intensity, curYear);
    renderHUD();
    if (proj === "休息") { pushLog(`训练${i}：休息，体力回复。`); continue; }
    trained = true;
    pushLog(`训练${i}：${proj}（${intensity}）${diffAttrs(before)}`);
    if (Math.random() < E.CONFIG.TRAIN_EVENT_P) { await trainingEvent(); renderHUD(); }
  }
  // 伤病按训练周期判定一次(对齐脚本)
  if (trained) {
    const inj = E.rollInjury(P, curAge, false);
    renderHUD();
    if (inj === "teno") {
      pushLog(`训练周期后：腱鞘炎发病！每场 F −${E.CONFIG.INJ_TENO_F}。`, "bad");
      await say("⚠ 受伤 · 腱鞘炎", `<p>长时间高强度操作，你的手腕发出了抗议。</p>
        <p>每场比赛 F −${E.CONFIG.INJ_TENO_F}。只能用「理疗康复套餐」清除——<b>若拖到下赛年末仍未理疗，将触发「伤重退役」。</b></p>`, "忍痛继续");
    } else if (inj === "temp") {
      pushLog(`训练周期后：临时伤病。每场 F −${E.CONFIG.INJ_TEMP_F}（赛季末自愈）。`, "bad");
      await say("⚠ 临时伤病", `<p>肩颈/眼部/手腕的小毛病找上门。</p><p>每场比赛 F −${E.CONFIG.INJ_TEMP_F}，一个赛季后自动恢复，也可用理疗康复套餐立即清除。</p>`, "继续");
    }
  }
}

async function trainingEvent() {
  // v6.0：按权重抽取（容貌越高、商业休整年越易抽到商业类事件）。
  const key = E.pickTrainingEvent(P);
  const ev = E.TRAIN_EVENTS[key];
  // feedback15: 选项不带 hint(数值)
  const idx = await choose(`突发事件 · ${key}`, `<p class="flavor">${ev.flavor}</p>`,
    ev.options.map(o => ({ label: o.label })));
  const result = ev.options[idx].apply(P);
  P._clamp(); renderHUD();
  if (P._fired) { throw { forced: "你被开除了！" }; }
  pushLog(`${key}：${ev.options[idx].label}`, key === "私联粉丝" ? "bad" : "");
  await say(`事件结果 · ${key}`, `<p>${result}</p>`, "继续");   // 结果公布数值
}

/* ============================== 商店 ================================== */
async function shopPhase() {
  setStage("年度商店");
  // 当年生效的道具/稀缺效果于赛年开始（进商店）随库存刷新一并重置（道具不跨年）。
  P.has_wrist = false;
  P.has_checkup = false;
  P.redo_token = 0;
  P.has_seal = false;
  P.serum_active = false;
  // v6.4 / v5.3 §9.0：常驻基础 + 9 抽 5 常规 + 8% 命中稀缺抽 1。
  const stock = E.buildShopStock();
  const hasRare = stock.some(it => it.rare);
  const groups = ["体力恢复", "伤病防护", "临场爆发", "属性成长", "舆论处理", "极其稀缺"];
  const risk = injuryRiskLine();
  await new Promise((resolve) => {
    const render = () => {
      const sections = groups.map(g => {
        const items = stock.filter(it => it.group === g);
        if (!items.length) return "";
        const rare = g === "极其稀缺";
        const rows = items.map((it) => {
          const gi = stock.indexOf(it);
          const afford = P.money >= it.price && it.left > 0;
          const sold = it.left <= 0;
          return `<div class="shoprow ${rare ? "rare" : ""} ${sold ? "sold" : ""}">
            <div class="si-main"><div class="si-name">${rare ? `<span class="si-rarebadge">限定</span>` : ""}${it.name}</div><div class="si-tag">${it.tag}</div><div class="si-desc">${it.desc}</div></div>
            <div class="si-price">${it.price}G</div><div class="si-left">×${it.left}</div>
            <button class="si-buy" data-i="${gi}" ${afford ? "" : "disabled"}>${sold ? "售罄" : "购买"}</button>
          </div>`;
        }).join("");
        return `<div class="shopgroup ${rare ? "rare" : ""}"><div class="sg-title">${rare ? "✦ 极其稀缺（限定爆品）" : g}</div>${rows}</div>`;
      }).join("");
      main().innerHTML = `
        <div class="panel-head"><h2>赛年 ${curYear} · 年度商店</h2>
          <p class="sub">资金 <b>${P.money.toFixed(0)} G</b>。每年随机上架，常规 9 件抽 5；属性类立即生效且不受年龄衰减；消耗品进背包随时使用；护腕/体检当年生效且可叠加。</p></div>
        <div class="panel-body">
          ${risk ? `<div class="riskbar ${risk.level === "high" ? "ko" : "warn"}">⚠ 伤病风险预警：${risk.text}</div>` : ""}
          ${hasRare ? `<div class="rarebar">✦ 今年货架上出现了<b>极其稀缺商品</b>——8% 概率才会现身，错过要等下一年。</div>` : ""}
          <div class="shop">${sections}</div></div>
        <div class="choices"><button class="choice primary" id="shopDone"><span class="cl">采购完毕，进入训练</span></button></div>`;
      main().querySelectorAll(".si-buy:not([disabled])").forEach(b => { b.onclick = () => buy(stock[+b.dataset.i], render); });
      $("#shopDone").onclick = resolve;
    };
    render();
  });
}
function buy(it, render) {
  if (P.money < it.price || it.left <= 0) return;
  P.money -= it.price; it.left -= 1;
  if (it.kind === "attr") {
    for (const [k, v] of Object.entries(it.eff)) P[k] = Math.min(100, P[k] + v);
    P._clamp(); flash(`购买${it.name}：${Object.entries(it.eff).map(([k, v]) => k + "+" + v).join("、")}`);
  } else if (it.kind === "wrist") { P.has_wrist = true; flash("购买护腕：本年受伤概率 ×0.4"); }
  else if (it.kind === "checkup") { P.has_checkup = true; flash("经纪团队体检：本年受伤概率 ×0.4（可叠加护腕）"); }
  else if (it.kind === "clear") { P.negative_news = false; flash("公关出手：负面新闻已清除"); }
  else if (it.kind === "redo") { P.redo_token += 1; flash("后悔药入手：本赛年可重打一场失利"); }
  else if (it.kind === "seal") { P.has_seal = true; flash("庄园密信入手：本年深渊减免所有冠军疲劳"); }
  else if (it.kind === "serum") { P.serum_active = true; flash("骨龄逆转血清生效：本赛年抹平年龄衰减"); }
  else if (it.kind === "consume") { P.inv[it.name] = (P.inv[it.name] || 0) + 1; flash(`购入${it.name}，已进背包`); }
  renderHUD(); render();
  pushLog(`商店购买：${it.name}（−${it.price}G）`);
}

/* ============================== 比赛 ================================== */
// 打一场，处理交互事件 + 赛后因果，返回 {win,F,team,opp,line,eventNarr,reason,fainted}
// 单面骰字形（按发挥档 1-6 取点）。
function diceFace(t) { return "⚀⚁⚂⚃⚄⚅"[clamp(t, 1, 6) - 1] || "⚅"; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* 手动掷骰（v6.4 / v5.3 §六.2）：仅季后赛 / 深渊总决赛触发。玩家点「该你上场了！」投出本场临场浮动 r∈[−V,+V]，
 * 区间 / 分布与系统自动取值完全一致；落点按六等分映射成 6 档发挥反馈（纯展示，不二次影响判定）。
 * 返回掷出的 r（交给 computeF 作为 forcedRfloat）。redo 重打会再次调用本函数，得到全新随机浮动。 */
async function manualDiceRoll(p, redo, noBad) {
  const V = E.fluctV(p);
  return await new Promise((resolve) => {
    main().innerHTML = `
      <div class="panel-head"><h2>${redo ? "再来一次——该你上场了！" : "该你上场了！"}</h2>
        <p class="sub">${redo ? "后悔药已下肚，深呼吸，重新投出你今天的手感。" : "深呼吸——这一掷，决定你今天临场的手感。"}</p></div>
      <div class="panel-body dice-stage">
        <div class="dice-orb idle" id="diceOrb">🎲</div>
        <div class="dice-hint">${noBad ? "🎴 好运签生效：今天稳了，发挥不会失常。" : "点击下方按钮，投出本场临场状态。"}</div>
      </div>
      <div class="choices"><button class="choice primary" id="rollBtn"><span class="cl">该你上场了！</span><span class="ch">投掷</span></button></div>`;
    $("#rollBtn").onclick = () => {
      // 好运签生效时浮动落点下限抬到 −V/3（必为稳定档及以上），UI 投掷流程与反馈不变。
      const r = E.rollFluct(V, noBad);
      const fb = E.diceTier(r, V);
      // 立即揭晓结果（投掷悬念交给纯 CSS 入场动画，不依赖 JS 定时器，便于自动化测试稳定推进）。
      main().innerHTML = `
        <div class="panel-head"><h2>临场状态 · 第 ${fb.tier} 档</h2>
          <p class="sub">发挥分档：1–2 失常 / 3–4 稳定 / 5–6 超常</p></div>
        <div class="panel-body dice-stage">
          <div class="dice-result reveal tier${fb.tier} grp-${fb.group}">
            <div class="dice-pips">${diceFace(fb.tier)}</div>
            <div class="dice-tier">${fb.group} · ${fb.sub}</div>
            <p class="dice-text">${fb.text}</p>
          </div>
        </div>
        <div class="choices"><button class="choice primary" id="diceGo"><span class="cl">带着这个状态打</span></button></div>`;
      $("#diceGo").onclick = () => resolve(r);
    };
  });
}

async function playMatch(stage, oppPopBase, winPop, opts = {}) {
  const { oppBonus = 0, dayFirst = false, keyMatch = false } = opts;
  if (dayFirst) { P.stamina = E.matchStartStamina(P); P.fired_events = new Set(); }
  if (!P.fired_events) P.fired_events = new Set();
  P.stamina -= E.gameCost(stage);
  const fainted = P.stamina <= 0;
  renderHUD();

  let fdelta = 0, eventNarr = null;
  // 常规赛：本阶段最多触发一次比赛期事件（demov2.1feedback2）
  const ev = E.rollMatchEvent(P, { atMostOne: stage === "常规" });
  if (ev) {
    if (ev.needChoice) {
      const idx = await choose(`赛中事件 · ${ev.key}`, `<p class="flavor">${ev.flavor}</p>`,
        ev.options.map(o => ({ label: o.label })));   // feedback15: 无数值
      const r = ev.options[idx].resolve(P);
      fdelta = r.fdelta; eventNarr = r.txt; renderHUD();
    } else { fdelta = ev.fdelta || 0; eventNarr = ev.txt; }
  }

  const buff = P.nextGameBuff; P.nextGameBuff = 0;
  const noBad = P.nextNoBadRoll; P.nextNoBadRoll = false;   // 好运签：本场临场发挥不会失常
  P.nextGameBuffUsed = buff > 0;
  const manual = E.isManualDiceStage(stage) && !fainted;

  // settleGame 会即时改动 pop / money / year_f / injured_win；后悔药重打需先回滚再重算，
  // 故先快照这些字段，redo 时还原后再跑一次（重打用全新随机浮动，不再扣体力 / 不重触发事件）。
  const snap = () => ({ pop: P.pop, money: P.money, injured_win: P.injured_win, yfLen: P.year_f.length });
  const restore = (s) => { P.pop = s.pop; P.money = s.money; P.injured_win = s.injured_win; P.year_f.length = s.yfLen; };
  const s0 = snap();

  const runAttempt = async (redo) => {
    const forcedR = manual ? await manualDiceRoll(P, redo, noBad) : null;
    const { F, cheer, rfloat, V } = E.computeF(P, stage, oppPopBase, curYear, oppBonus, fdelta, buff, forcedR, noBad);
    const { team, opp, win } = E.settleGame(P, stage, oppPopBase, winPop, curYear, F, fainted, oppBonus);
    renderHUD();
    return { F, cheer, team, opp, win, rfloat, V };
  };

  let a = await runAttempt(false);
  // 后悔药（v6.4 / v5.3 §九·稀缺）：手动掷骰阶段打输且持有重开额度时，可立刻重打一次。
  if (!a.win && !fainted && P.redo_token > 0 && manual) {
    const idx = await choose("后悔药 · 要重来一次吗？",
      `<p class="flavor">输了别急着摔键盘——这一颗后悔药，能让你把刚才那场重新打一遍（全新临场手感，本赛年仅此一次）。</p>
       <p class="muted">剩余后悔药：${P.redo_token} 颗　·　刚才：你 ${a.F.toFixed(0)} vs 对手 ${a.opp.toFixed(0)}</p>`,
      [{ label: "吞下后悔药，重打这一场", cls: "primary" }, { label: "算了，接受结果" }]);
    if (idx === 0) {
      P.redo_token -= 1;
      restore(s0);
      renderHUD();
      pushLog("后悔药生效：重打这一场。", "good");
      a = await runAttempt(true);
    }
  }
  const { F, cheer, team, opp, win } = a;

  const tags = E.reasonTags(P, { stage, win, keyMatch, F, opp, team, cheer, fainted, year: curYear, age: curAge });
  const reason = E.pickReason(tags, win);
  P.nextGameBuffUsed = false;

  // v6.0 赛事名场面（纯叙事彩蛋）：失常 = 随机浮动落 1-2 档（r < −V/3）；命中则结算并弹出彩蛋页。
  const abnormal = a.rfloat < -a.V / 3;
  const spot = E.rollSpotlight(P, win, abnormal);
  if (spot) {
    renderHUD();
    pushLog(`赛事名场面 · ${spot.name}（人气 +2、稳定 +2）`, "good");
    await say(spot.title, `<p class="flavor">${spot.text}</p><p class="ok">这一幕被定格为赛事名场面 —— 人气 +2、稳定 +2。</p>`, "笑纳这波热度");
  }

  let line = `${win ? "✔ 胜" : "✘ 负"}　你 ${F.toFixed(0)}（队 ${team.toFixed(0)}）vs 对手 ${opp.toFixed(0)}`;
  if (fainted) line = `✘ 体力清零·晕倒判负　对手 ${opp.toFixed(0)}`;
  if (spot) line += `　🎬 名场面「${spot.name}」`;
  return { win, F, team, opp, line, eventNarr, reason, fainted, spot };
}

// 赛事开始前的一次伤病掷骰(比赛口径)
async function competitionInjury(label) {
  const inj = E.rollInjury(P, curAge, true);
  renderHUD();
  if (inj === "teno") {
    pushLog(`${label}前：腱鞘炎发病！`, "bad");
    await say("⚠ 赛前伤病 · 腱鞘炎", `<p>就在${label}开打前，手腕的旧伤又犯了。每场 F −${E.CONFIG.INJ_TENO_F}，需理疗清除。</p>`, "带伤上场");
  } else if (inj === "temp") {
    pushLog(`${label}前：临时伤病。`, "bad");
    await say("⚠ 赛前临时伤病", `<p>${label}前你有点小状况，每场 F −${E.CONFIG.INJ_TEMP_F}（赛季末自愈）。</p>`, "继续");
  }
}

function reasonHtml(r) { return r ? `<p class="reason">「${r}」</p>` : ""; }

// 常规赛：9 场，批量呈现。返回 {rank, inPlayoff, wins}
async function regularSeason(kind) {
  setStage(`${kind}季赛·常规赛`);
  P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
  renderHUD();                 // 进入比赛周期即时刷新体力（demov2.1feedback2）
  // v6.5《demov2.2feedback》：常规赛不再直接开打，先给一个开赛说明界面 + 进入按钮。
  await say(`${kind}季赛 · 常规赛`, `
    <p class="flavor">${kind}季赛常规赛即将打响——9 场 BO3 定排名，<b>前 6 名</b>晋级双败淘汰季后赛。</p>
    <p class="muted">当前体力 ${P.stamina.toFixed(0)} / ${P.stamina_max.toFixed(0)}${P.nextGameBuff ? `，预备 F buff +${P.nextGameBuff.toFixed(0)}` : ""}。可在右侧背包提前补给体力或叠加临场 buff。</p>`,
    `进入${kind}季赛常规赛`);
  const lines = []; let wins = 0; let lastReason = null;
  for (let g = 1; g <= 9; g++) {
    const r = await playMatch("常规", E.OPP_POP["常规"], E.WIN_POP["常规"]);
    if (r.win) wins++; if (r.reason) lastReason = r.reason;
    lines.push(`<div class="gline ${r.win ? "w" : "l"}">第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
  }
  const others = []; for (let i = 0; i < 9; i++) { let w = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) w++; others.push(w); }
  const better = others.filter(w => w > wins).length;
  const ties = others.filter(w => w === wins).length;
  const rank = 1 + better + E.randint(0, ties);
  const inPlayoff = rank <= 6;
  P.recent_perf = wins / 9.0;
  pushLog(`${kind}季赛常规赛：${wins}胜，第 ${rank} 名，${inPlayoff ? "晋级季后赛" : "无缘季后赛"}。`, inPlayoff ? "good" : "bad");
  await say(`${kind}季赛 · 常规赛战报`, `
    <div class="gamelog">${lines.join("")}</div>
    ${reasonHtml(lastReason)}
    <p class="summary">常规赛 <b>${wins} 胜 ${9 - wins} 负</b>，最终排名 <b>第 ${rank} 名</b>（前 6 进双败季后赛）。</p>
    <p class="${inPlayoff ? "ok" : "ko"}">${inPlayoff ? "🎉 晋级季后赛！" : "😔 遗憾止步常规赛。"}</p>`,
    inPlayoff ? "进入季后赛" : "继续");
  return { rank, inPlayoff, wins };
}

/* ---------------------- 双败淘汰季后赛(前6进) ------------------------- *
 * 严格移植脚本 play_domestic_playoff: 4 个比赛日, 逐一定名次。
 * 每个"比赛日"是一场 BO5(dayFirst 回体力+重置事件去重)；关键场对手 +2。
 * 返回 {place(1冠/2亚/3季/4/5/6), fList}。
 * --------------------------------------------------------------------- */
async function playoffGame(kind, dayName, dayFirst, key, fList) {
  // 新比赛日：先回复体力并刷新看板，再展示备战提示——避免提示与背包显示的是恢复前的旧体力，
  // 也让玩家在备战界面补给的体力/buff 不被随后的开打重置覆盖（demov2.1feedback2）。
  if (dayFirst) { P.stamina = E.matchStartStamina(P); P.fired_events = new Set(); renderHUD(); }
  await say(`${kind}季赛·季后赛 · ${dayName}`, `
    <p>${dayName} 即将开打（BO5）。可在右侧背包使用道具补给体力或叠加 F buff。</p>
    <p class="muted">当前体力 ${P.stamina.toFixed(0)} / ${P.stamina_max.toFixed(0)}${P.nextGameBuff ? `，预备 F buff +${P.nextGameBuff.toFixed(0)}` : ""}${key ? "　·　关键场：对手 +2" : ""}</p>`, "开打");
  const r = await playMatch("季后", E.OPP_POP["季后"], E.WIN_POP["季后"], { keyMatch: key, oppBonus: key ? 2 : 0 });
  fList.push(r.F);
  pushLog(`${kind}季后赛·${dayName}：${r.win ? "胜" : "负"}`, r.win ? "good" : "bad");
  await say(`${dayName} · 结果`, `<div class="gline ${r.win ? "w" : "l"} big">${r.line}</div>
    ${r.eventNarr ? `<p class="gev2">${r.eventNarr}</p>` : ""}${reasonHtml(r.reason)}`, r.win ? "继续" : "接受结果");
  return r.win;
}

async function playDomesticPlayoff(kind, seed) {
  setStage(`${kind}季赛·双败季后赛`);
  const fList = [];
  const g = (dayName, dayFirst, key) => playoffGame(kind, dayName, dayFirst, key, fList);

  if (seed <= 4) {
    const inWr1 = (seed === 1 || seed === 4);
    if (await g("胜者组首轮", true, false)) {
      if (await g("胜者组决赛", true, false)) {
        if (await g("总决赛", true, true)) return { place: 1, fList };
        return { place: 2, fList };
      }
      if (await g("败者组决赛", true, true)) {
        if (await g("总决赛", true, true)) return { place: 1, fList };
        return { place: 2, fList };
      }
      return { place: 3, fList };
    }
    if (inWr1) {
      if (!(await g("败者组 LR3", true, false))) return { place: 4, fList };
      if (!(await g("败者组决赛", false, true))) return { place: 3, fList };
      if (await g("总决赛", true, true)) return { place: 1, fList };
      return { place: 2, fList };
    } else {
      if (!(await g("败者组 LR2", true, false))) return { place: 5, fList };
      if (!(await g("败者组 LR3", true, false))) return { place: 4, fList };
      if (!(await g("败者组决赛", false, true))) return { place: 3, fList };
      if (await g("总决赛", true, true)) return { place: 1, fList };
      return { place: 2, fList };
    }
  } else {
    if (!(await g("败者组 LR1", true, false))) return { place: 6, fList };
    if (!(await g("败者组 LR2", true, false))) return { place: 5, fList };
    if (!(await g("败者组 LR3", true, false))) return { place: 4, fList };
    if (!(await g("败者组决赛", false, true))) return { place: 3, fList };
    if (await g("总决赛", true, true)) return { place: 1, fList };
    return { place: 2, fList };
  }
}

/* ---------------------- 冠军 / 名次结算 + FMVP ------------------------ */
function titleOf(kind) { return kind === "IVS" ? "IVS" : (kind === "深渊" ? "深渊（全球赛）" : kind + "季赛"); }

async function settleChampion(kind, fList) {
  const fm = E.checkFMVP(P, curYear, fList);
  E.settleChamp(P, kind, curYear, fm.won);
  const [popR, moneyR] = E.CONFIG.CHAMP_REWARD[kind];
  let body = `<p class="champ-banner">🏆 ${titleOf(kind)}冠军！</p>
    <p>奖励：人气 +${popR}（×外貌系数 ${P.pop_mult.toFixed(2)}）、资金 +${moneyR}G。</p>`;
  if (fm.won) {
    const sp = E.fmvpSpeech(P, kind, curYear);
    body += `<p class="fmvp">⭐ 你当选 FMVP！场均 F ${fm.avg.toFixed(1)}，额外 人气+20、资金+1500。</p>
      <p class="speech">${sp.poem}</p><p class="fmvp-credit">${sp.credit}</p>`;
    pushLog(`${titleOf(kind)}夺冠 + FMVP！`, "good");
  } else {
    let why = fm.reason === "low" ? `场均 F ${fm.avg.toFixed(1)} 未达 90 门槛`
      : fm.reason === "mate" ? `场均 ${fm.avg.toFixed(1)} 未压过所有队友`
      : `通过资格，但 FMVP 投票惜败（中选率 ${(fm.p * 100).toFixed(0)}%）`;
    body += `<p class="muted">关于 FMVP：${why}。<b>冠军不等于 FMVP</b>——奖杯属于全队，MVP 还需更硬的个人数据与一点运气。</p>`;
    pushLog(`${titleOf(kind)}夺冠（无 FMVP）。`, "good");
  }
  await say(`${titleOf(kind)} · 夺冠！`, body, "登顶时刻");
}
async function settlePlacement(kind, place, fList) {
  if (place === 1) { await settleChampion(kind, fList); }
  else if (place === 2) {
    E.settleRunnerup(P, kind); pushLog(`${titleOf(kind)}亚军。`, "");
    await say(`${titleOf(kind)} · 亚军`, `<p>决赛惜败，屈居亚军。人气 +8（×外貌）、资金 +${(E.CONFIG.CHAMP_REWARD[kind][1] / 3).toFixed(0)}G。</p>
      <p class="muted">差一步登顶。亚军 + 季军累计够多、技战术够硬，也能走向「无冕之王」。</p>`, "继续");
  } else if (place === 3) {
    E.settleThird(P, kind); pushLog(`${titleOf(kind)}季军。`, "");
    await say(`${titleOf(kind)} · 季军`, `<p>季军赛你顶住了，拿下一枚铜牌。人气 +4（×外貌）、资金 +${(E.CONFIG.CHAMP_REWARD[kind][1] / 6).toFixed(0)}G。</p>`, "继续");
  } else {
    pushLog(`${titleOf(kind)}止步第 ${place} 名。`, "");
    await say(`${titleOf(kind)} · 出局`, `<p>本届${titleOf(kind)}止步第 ${place} 名。胜场涨粉已计入。</p>`, "继续");
  }
}

// 夏/秋季赛：常规赛 → 双败季后赛。返回季后名次(无缘=8)
async function playDomestic(kind) {
  await competitionInjury(`${kind}季赛`);
  const { rank, inPlayoff } = await regularSeason(kind);
  if (!inPlayoff) { E.endCompetition(P); return 8; }
  P.playoff_count += 1;
  await say(`${kind}季赛 · 季后赛`, `<p class="flavor">常规赛尘埃落定，真正的淘汰赛才刚刚开始。从这里起，输一场，可能就是一整年的结束。</p>`, "进入季后赛");
  const { place, fList } = await playDomesticPlayoff(kind, rank);
  P.recent_perf = place === 1 ? 1.0 : 0.5;
  await settlePlacement(kind, place, fList);
  E.endCompetition(P);
  return place;
}

// 通用淘汰/循环小赛段：返回 {wins, fList, lastReason}
async function playSeries(stage, n, oppPopBase, winPop, knockout, label) {
  setStage(label);
  P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
  renderHUD();                 // 进入比赛周期即时刷新体力（demov2.1feedback2）
  let wins = 0; const fList = []; const lines = []; let lastReason = null;
  for (let g = 1; g <= n; g++) {
    const r = await playMatch(stage, oppPopBase, winPop);
    fList.push(r.F); if (r.win) wins++; if (r.reason) lastReason = r.reason;
    lines.push(`<div class="gline ${r.win ? "w" : "l"}">第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
    if (knockout && !r.win) break;
  }
  return { wins, fList, lines, lastReason };
}

async function playIVS() {
  await competitionInjury("IVS");
  await say("洲际邀请赛 IVS", `<p>你随队代表赛区出征 IVS！这里云集跨赛区精英，对手强度陡增（[70,84]）。</p>`, "出征");
  const { wins, fList, lines, lastReason } = await playSeries("IVS", 3, E.OPP_POP["IVS"], E.WIN_POP["IVS"], true, "洲际邀请赛 IVS");
  await say("IVS · 战报", `<div class="gamelog">${lines.join("")}</div>${reasonHtml(lastReason)}<p class="summary">${wins} 胜（3 连胜夺冠，2 胜止步亚军）。</p>`, "继续");
  P.recent_perf = wins / 3.0;
  await settlePlacement("IVS", wins === 3 ? 1 : (wins === 2 ? 2 : 4), fList);
  E.endCompetition(P);
}

async function playAbyss(seeded) {
  await competitionInjury("深渊");
  // 庄园密信（v6.0 增强）：进深渊前减免所有冠军疲劳——当年累积的全部金满贯同步疲劳一次性清零。
  if (P.has_seal && P._abyss_fatigue > 0) {
    const before = P._abyss_fatigue;
    P._abyss_fatigue = 0;
    P.has_seal = false;
    renderHUD();
    pushLog(`庄园密信生效：减免所有冠军疲劳（同步疲劳 −${before.toFixed(0)} → 0）。`, "good");
    await say("庄园密信 · 特赦令", `
      <p class="flavor">横扫赛季的疲惫，由这封密信替你全数扛下。深渊里，你还是满状态的那个你。</p>
      <p>减免所有冠军疲劳：深渊每场 F 回补 <b>+${before.toFixed(0)}</b>，本年深渊已无任何同步疲劳。</p>`, "继续");
  }
  await say("深渊的呼唤 · 全球赛", `
    <p class="flavor">深渊的呼唤——全球最高规格的舞台。能站在这里的，没有一个是弱者。</p>
    <p>${seeded ? "凭借国内季后赛的出色表现，你被<b>保送小组赛</b>，跳过预选！" : "你需要先从预选赛打起（2 场，胜 ≥1 进小组）。"}</p>
    ${P._abyss_fatigue > 0 ? `<p class="muted">⚠ 同年同步疲劳：本年深渊前已夺 ${(P._abyss_fatigue / E.CONFIG.ABYSS_SYNC_FATIGUE_PER).toFixed(0)} 冠，深渊每场 F −${P._abyss_fatigue.toFixed(0)}（每多 1 冠 −2，封顶 −6）。</p>` : ""}`, "进入深渊");

  if (!seeded) {
    const pre = await playSeries("预选", 2, E.OPP_POP["深渊"], E.WIN_POP["预选"], false, "深渊·预选赛");
    await say("深渊 · 预选赛战报", `<div class="gamelog">${pre.lines.join("")}</div>${reasonHtml(pre.lastReason)}<p class="summary">预选 ${pre.wins} 胜（需 ≥1 进小组）。</p>`, "继续");
    if (pre.wins < 1) { pushLog("深渊预选出局。", "bad"); E.endCompetition(P); await say("深渊 · 止步预选", `<p>预选赛未能取胜，今年的深渊之旅到此为止。</p>`, "继续"); return; }
  }

  const grp = await playSeries("小组", 3, E.OPP_POP["深渊"], E.WIN_POP["小组"], false, "深渊·小组赛");
  await say("深渊 · 小组赛战报", `<div class="gamelog">${grp.lines.join("")}</div>${reasonHtml(grp.lastReason)}<p class="summary">小组 ${grp.wins} 胜（需 ≥2 进总决赛）。</p>`, grp.wins >= 2 ? "挺进总决赛" : "继续");
  if (grp.wins < 2) { pushLog("深渊小组赛出局。", "bad"); P.recent_perf = grp.wins / 3.0; E.endCompetition(P); await say("深渊 · 止步小组", `<p>小组赛功亏一篑，无缘总决赛。</p>`, "继续"); return; }

  // 总决赛淘汰：四强 → 半决 → 决赛；半决败者打季军赛
  setStage("深渊·总决赛");
  P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
  renderHUD();                 // 进入比赛周期即时刷新体力（demov2.1feedback2）
  const fl = [];
  const fg = async (name, key) => {
    await say(`深渊·总决赛 · ${name}`, `<p>${name} 即将开打（BO5）。${key ? "关键场：对手 +2。" : ""}</p><p class="muted">体力 ${P.stamina.toFixed(0)} / ${P.stamina_max.toFixed(0)}</p>`, "开打");
    const r = await playMatch("总决", E.OPP_POP["深渊"], E.WIN_POP["总决"], { keyMatch: key, oppBonus: key ? 2 : 0 });
    fl.push(r.F);
    await say(`${name} · 结果`, `<div class="gline ${r.win ? "w" : "l"} big">${r.line}</div>${r.eventNarr ? `<p class="gev2">${r.eventNarr}</p>` : ""}${reasonHtml(r.reason)}`, r.win ? "继续" : "接受结果");
    return r.win;
  };
  let placed = 8;
  if (await fg("四强赛", false)) {
    if (await fg("半决赛", false)) {
      if (await fg("总决赛", true)) placed = 1; else placed = 2;
    } else {
      if (await fg("季军赛", true)) placed = 3; else placed = 4;
    }
  }
  P.recent_perf = placed === 1 ? 1.0 : (placed <= 3 ? 0.5 : 0.2);
  await settlePlacement("深渊", placed, fl);
  E.endCompetition(P);
}

/* ============================ 队内选拔 ================================ */
async function selection(eventLabel) {
  if (P.is_starter) return true;
  setStage(`${eventLabel}·队内选拔`);
  if (Math.random() < E.CONFIG.SELECT_VACANCY_P) {
    P.is_starter = true; P.ever_starter = true; P.consec_fail = 0; renderHUD();
    pushLog(`${eventLabel}：队内缺人，直接首发转正！`, "good");
    await say(`${eventLabel} · 队内选拔`, `<p class="flavor">战队没有替补，你作为首发队员亮相赛场。</p>`, "上场");
    return true;
  }
  const score = P.cp + (P.luck - 50) * 0.1;   // 运气隐藏参与判定，但不展示
  let thr = E.selectThreshold(curYear);
  if (P.identity === "主播" && curYear === 1) thr -= 3;
  if (score >= thr) {
    P.is_starter = true; P.ever_starter = true; P.consec_fail = 0; renderHUD();
    pushLog(`${eventLabel}：选拔通过，转正主力！`, "good");
    await say(`${eventLabel} · 队内选拔`, `<p class="flavor">训练中的表现教练都看在眼里。你顺利成为战队首发。</p><p class="muted">转正主力，此后免选拔。</p>`, "上场");
    return true;
  }
  P.consec_fail += 1; P.ever_fail = true;
  if (curYear === 1) P.first_year_failed = true;
  renderHUD();
  pushLog(`${eventLabel}：选拔失败（连续 ${P.consec_fail} 次），观赛。`, "bad");
  if (P.consec_fail >= 3) throw { forced: "饮水机管理员" };
  await say(`${eventLabel} · 队内选拔`, `
    <p class="flavor">首发位你没能拿下，只能坐在备战间看队友出战。机会，得自己一点点挣回来。</p>
    <p class="${P.consec_fail >= 2 ? "ko" : "muted"}">连续未通过：${P.consec_fail}/3（满 3 次将被强制结局「饮水机管理员」）。${curYear === 1 ? "（首年失败已记入「光荣的荆棘路」前置）" : ""}</p>`, "继续");
  return false;
}

/* ============================== 转会窗口 ============================== */
// 转会后可重新输入一次队伍名称（选手 ID 不变），完整 ID 随之更新（策划 §六.5）。
async function renameTeamPrompt() {
  const oldFull = P.name;
  const newTeam = await textPrompt({
    step: "转会", sub: `你来到了新的战队，可以重新设定队伍名称（选手 ID「${P.playerId}」保持不变）`,
    inputId: "teamInput", btnId: "teamOk", placeholder: P.teamName, fallback: P.teamName,
    preview: (t) => `${t}_${P.playerId}`,
  });
  P.renameTeam(newTeam); renderHUD();
  pushLog(`完整 ID 更新：${oldFull} → ${P.name}`, "");
}

async function transferWindow(label) {
  setStage(`${label}·转会窗口`);
  const forced = E.transferRollForced(P);
  let moved = false;
  if (forced === "sell") {
    E.doTransfer(P); moved = true;
    pushLog(`${label}：被发卖，加入新战队。`, "");
    await say(`转会窗口 · ${label}`, `<p class="flavor">经理把你叫进办公室，话说得委婉，意思却清楚：俱乐部已经替你联系好了下家。这一次，你没有选择权。</p>`, "接受");
    await renameTeamPrompt();
  } else if (forced === "offer") {
    const idx = await choose(`转会窗口 · ${label}`,
      `<p class="flavor">有别的战队抛来橄榄枝，条件开得很诱人。教练和经理把决定权交回你手上——是留下，还是走？</p>`,
      [{ label: "留队", hint: "珍惜现有默契，冲击「一人一城」" }, { label: "接受转会", hint: "换个环境，队友基准随机变化" }]);
    if (idx === 1) {
      E.doTransfer(P); moved = true;
      pushLog(`${label}：主动转会。`, "");
      await renameTeamPrompt();
    }
  }
  const amb = E.transferAmbient(P);
  if (!moved) {
    for (const e of amb) {
      if (e.t === "in") {
        pushLog(`${label}：新队友试训加入。`, "");
        await say(`转会窗口 · ${label}`, `<p class="flavor">训练室来了张新面孔，是来试训的新人。眼里那股拼劲，让你想起了刚出道时的自己。</p>`, "继续");
      } else {
        pushLog(`${label}：老队友告别离队。`, "");
        await say(`转会窗口 · ${label}`, `<p class="flavor">一起打了这么久的队友要走了。最后一次合练结束，谁都没急着摘下耳机。</p>`, "继续");
      }
    }
    if (P.opp_delta_extra !== 0) {
      pushLog(`${label}：其他战队人员有所变动。`, "");
      await say(`转会窗口 · ${label}`, `<p class="flavor">你听说，这个转会期其他战队的人员有所变动。</p>`, "继续");
    }
  }
}

/* ============================ 商业休整 ================================ */
async function commercialRestOffer() {
  if (!(P.identity === "青训" && curYear === 1) && E.commercialRestEligible(P, curYear)) {
    const idx = await choose("人生节奏 · 商业休整", `
      <p class="flavor">经纪人敲门进来：「这赛季的商务排得很满。要不要少练一点，把热度和身体都先稳住？」</p>
      <p class="muted">效果：本赛年训练周期 5→3 次、训练收益 ×0.8、伤病判定概率 ×0.5、赛年结束额外人气 +2~5（×外貌）。帮助你更稳地走向签约艺人/短剧/流量为王等非竞技路线。</p>`,
      [{ label: "正常备战，专注训练", hint: "训练 5 次、不减伤" }, { label: "接受商业休整", hint: "训练 3 次、伤病 ×0.5、年末涨粉" }]);
    P.rest_active = (idx === 1);
  } else {
    P.rest_active = false;
  }
  P.rest_growth_mult = P.rest_active ? E.CONFIG.REST_GROWTH_MULT : 1.0;
  if (P.rest_active) {
    pushLog(`赛年 ${curYear}：选择商业休整。`, "");
    await say("商业休整", `<p class="flavor">你点了头。这一年，训练室的灯暗了一些，但镜头前的你，比任何时候都亮。</p>`, "继续");
  }
  renderHUD();
}

/* ============================ 年度评选 ================================ */
async function annualAwards() {
  setStage("年度评选");
  const out = E.annualAwards(P, curYear);
  const got = [];
  if (out.best) got.push("年度最佳演绎");
  if (out.popular) got.push("年度人气选手");
  if (!got.length) return;
  pushLog(`年度评选：${got.join("、")}！`, "good");
  await say(`赛年 ${curYear} · 年度评选`, `
    <p class="champ-banner">🎖 你入选 ${got.join(" + ")}！</p>
    ${out.best ? `<p class="flavor">颁奖礼上，「年度最佳演绎」的名字被念出来——是你。这一年所有的苦练，都浓缩进了这一刻的掌声里。</p>` : ""}
    ${out.popular ? `<p class="flavor">年度人气选手公布，你的名字稳稳排在前三。这份热度，是粉丝一票一票投出来的。</p>` : ""}`, "继续");
}

/* ========================= 半途特殊结局(二选一) ======================= */
// 结局文案严格取自《文案设计 v1.1》§13.1；短剧演员的二选一用文案指定措辞。
async function offerSpecial(name) {
  P.offered.add(name);
  const acceptLabel = name === "短剧演员" ? "那还说啥了，我将震碎娱乐圈" : `接受 →【达成结局·${name}】`;
  const idx = await choose(`人生岔路 · ${name}`, `
    <p class="flavor">${E.ENDING_TEXT[name]}</p>`,
    [{ label: "我还是更喜欢赛场", hint: "继续游戏（本周目不再提示）" },
     { label: acceptLabel, hint: `达成结局·${name}`, cls: "primary" }]);
  return idx === 1;
}

/* ============================== 主流程 ================================ */
function snapshotAttrs() { return { tech: P.tech, tac: P.tac, phys: P.phys, stab: P.stab, pop: P.pop, money: P.money }; }
function diffAttrs(b) {
  const parts = []; const map = { tech: "技", tac: "战", phys: "体", stab: "稳" };
  for (const k of ["tech", "tac", "phys", "stab"]) { const d = P[k] - b[k]; if (Math.abs(d) > 0.05) parts.push(`${map[k]}${d > 0 ? "+" : ""}${d.toFixed(1)}`); }
  const dp = P.pop - b.pop; if (Math.abs(dp) > 0.01) parts.push(`人气${dp > 0 ? "+" : ""}${dp.toFixed(1)}`);
  return parts.length ? "→ " + parts.join(" ") : "";
}

async function yearIntro() {
  setStage("赛年开始");
  P.negative_news = false;                  // 负面新闻随时间(新赛年)消散
  if (curYear === 1) return;
  P.advanceTeammate();                      // 战术驱动的队友配合逐年提升（封顶 +3/年，静默累积）
  await say(`赛年 ${curYear}（${curAge} 岁）`, `
    <p>新的一年开始了。商店已刷新，负面新闻随时间消散。</p>
    ${curYear >= 4 ? `<p class="muted">已进入成长衰减期：技术/体能成长 ×${E.growthTech(curYear).toFixed(2)}，战术 ×${E.growthTac(curYear).toFixed(2)}。靠道具/事件补满属性更重要。</p>` : ""}`, "查看赛季目标");
}

async function yearSettle() {
  setStage("赛年结算");
  const a = `技${P.tech.toFixed(0)} 战${P.tac.toFixed(0)} 体${P.phys.toFixed(0)} 稳${P.stab.toFixed(0)}`;
  await say(`赛年 ${curYear} 结算`, `
    <p>本赛年结束。当前面板：${a} · 容貌${P.appearance.toFixed(0)}。</p>
    <p>人气 <b>${P.pop.toFixed(1)} 万</b>，资金 <b>${P.money.toFixed(0)} G</b>，冠军 ${P.totalChamp} 座，FMVP ${P.fmvp_total} 次，进季后赛 ${P.playoff_count} 次，亚军 ${P.runnerups}/季军 ${P.thirds}。</p>
    ${P.rest_active ? `<p class="muted">商业休整年：商务曝光带来额外人气，但训练放缓。</p>` : ""}
    ${curYear < 7 ? "" : `<p class="ok">7 个赛年走到了尽头……</p>`}`, curYear < 7 ? `进入赛年 ${curYear + 1}` : "迎接结局");
}

async function career() {
  let grandSlam = false, forced = null, yearsCompleted = 0;
  try {
    for (curYear = 1; curYear <= E.CONFIG.YEARS; curYear++) {
      curAge = E.CONFIG.START_AGE + (curYear - 1);
      P.cur_year = curYear; P.year_f = [];
      renderHUD();
      await yearIntro();
      await seasonGoalPanel();
      await shopPhase();
      await commercialRestOffer();

      const yc = new Set();
      let summerRank = 8, autumnRank = 8;

      const n1 = (P.identity === "青训" && curYear === 1) ? 7 : (P.rest_active ? E.CONFIG.REST_TRAIN_N : 5);
      await trainingPeriod(n1, "训练① · 季前");

      if (await selection("夏季赛")) { const b = P.champ["夏"]; summerRank = await playDomestic("夏"); if (P.champ["夏"] > b) yc.add("夏"); }
      await transferWindow("夏季赛后");

      if (summerRank <= 2 && P.is_starter) { const b = P.champ["IVS"]; await playIVS(); if (P.champ["IVS"] > b) yc.add("IVS"); }

      await trainingPeriod(P.rest_active ? E.CONFIG.REST_TRAIN_N : 5, "训练② · 夏秋之间");

      if (await selection("秋季赛")) { const b = P.champ["秋"]; autumnRank = await playDomestic("秋"); if (P.champ["秋"] > b) yc.add("秋"); }

      await trainingPeriod(P.rest_active ? E.CONFIG.REST_TRAIN_N : 5, "训练③ · 深渊前");

      if (await selection("深渊")) {
        const seeded = (summerRank + autumnRank) / 2.0 <= 2.0;
        // v6.0：每多 1 冠 −2/场，整场封顶 −6。
        P._abyss_fatigue = Math.min(E.CONFIG.ABYSS_SYNC_FATIGUE_CAP, E.CONFIG.ABYSS_SYNC_FATIGUE_PER * yc.size);
        const b = P.champ["深渊"]; await playAbyss(seeded); P._abyss_fatigue = 0;
        if (P.champ["深渊"] > b) yc.add("深渊");
      }

      if (["夏", "秋", "IVS", "深渊"].every(k => yc.has(k))) grandSlam = true;

      await transferWindow("赛季末");
      await annualAwards();
      if (P.rest_active) { P.addPop(E.rnd(...E.CONFIG.REST_POP_RANGE)); P.rest_year_count += 1; }
      await yearSettle();

      for (const name of E.specialTriggers(P, curYear)) {
        if (P.offered.has(name)) continue;
        if (await offerSpecial(name)) { forced = name; throw { forced: name, special: true }; }
      }

      // 伤重退役计时(年末)
      if (P.teno_active && P.teno_onset_year !== null && (curYear - P.teno_onset_year) >= 1) {
        throw { forced: "伤重退役" };
      }
      yearsCompleted = curYear;
    }
  } catch (e) {
    if (e && e.forced) forced = e.forced; else throw e;
  }
  const fullCareer = (forced === null) && (yearsCompleted === E.CONFIG.YEARS);
  await ending(grandSlam, forced, fullCareer);
}

/* ============================== 结局 ================================== */
async function ending(grandSlam, forced, fullCareer) {
  setStage("生涯落幕");
  const isForced = ["饮水机管理员", "你被开除了！", "伤重退役"].includes(forced);
  const isSpecial = forced && !isForced;
  const ach = E.computeAchievements(P, fullCareer, grandSlam, forced);
  const finalName = isSpecial ? forced : E.finalEnding(P, fullCareer, grandSlam, forced, ach);

  pushLog(`生涯结束：${finalName}`, isForced ? "bad" : "good");

  const got = Object.keys(ach).filter(k => ach[k]);
  // 生涯战报卡数据（v3.0）：用于可截图分享 + 持久化存档。
  const rec = {
    v: 3, name: P.name, playerId: P.playerId, teamName: P.teamName,
    role: P.role, idShort: idShort(P), final: finalName, kind: isForced ? "forced" : (isSpecial ? "special" : "final"),
    fullCareer, tech: P.tech, tac: P.tac, phys: P.phys, stab: P.stab,
    appearance: P.appearance, luck: P.luck, pop: P.pop, money: P.money,
    champ: { ...P.champ }, runnerups: P.runnerups, thirds: P.thirds, fmvp_total: P.fmvp_total,
    playoff_count: P.playoff_count, transfer_count: P.transfer_count, rest_year_count: P.rest_year_count,
    spotlights: [...P.spotlight], achs: got, date: new Date().toLocaleDateString("zh-CN"),
  };
  // 持久化（v3.0）：localStorage 存当前周目战报 + 累计成就/结局图鉴（历史解锁）。
  const codex = persistRun(rec);

  // 结局界面循环：再来一局退出；其余按钮看完返回本页。feedback14：成就仅列名称。
  while (true) {
    setStage("生涯落幕");
    const choice = await present({
      title: `结局 · ${finalName}`,
      sub: isForced ? "强制结局" : (isSpecial ? "你主动接受了人生岔路" : (fullCareer ? "满 7 赛年 · 最终结局" : "生涯落幕")),
      body: warCardHtml(rec, isForced) + `
        <p class="muted sharehint">📸 截图保存这张战报卡，晒到同人圈吧！或点「复制战报文案」一键带走。</p>`,
      choices: [
        { label: "🏆 全部结局与成就", cls: "ghost" },
        { label: "📋 复制战报文案", cls: "ghost" },
        { label: "🔄 再来一局", cls: "primary" },
      ],
    });
    if (choice === 0) { await codexPanel(rec, codex); continue; }
    if (choice === 1) { await copyWarCard(rec); continue; }
    break;
  }
  logLines = []; P = null; renderHUD();
  // 重开由顶层 gameLoop() 循环驱动，ending() 直接返回，避免调用栈无限增长。
}

/* ----------------------- 生涯战报卡（v3.0 · 可截图分享） --------------------- */
function warCardHtml(rec, isForced) {
  const endingText = (E.ENDING_TEXT[rec.final] || "").replace("玩家ID", rec.playerId);
  const champLine = `夏 ${rec.champ["夏"]}　秋 ${rec.champ["秋"]}　IVS ${rec.champ["IVS"]}　深渊 ${rec.champ["深渊"]}`;
  const achHtml = rec.achs.length
    ? rec.achs.map(a => `<span class="achname">${a}</span>`).join("")
    : `<span class="ach muted">本周目未解锁成就</span>`;
  const spotHtml = rec.spotlights.length
    ? `<div class="wc-spot">🎬 名场面：${rec.spotlights.join("、")}</div>` : "";
  return `
    <div class="warcard ${isForced ? "bad" : "good"}" id="warcard">
      <div class="wc-top">
        <div class="wc-badge">IVL 生涯战报</div>
        <div class="wc-date">${rec.date}</div>
      </div>
      <div class="wc-name">${rec.name}<span class="wc-role">${rec.idShort}·${rec.role}</span></div>
      <div class="wc-ending">
        <div class="wc-ending-name">${rec.final}</div>
        <p class="wc-ending-text">${endingText}</p>
      </div>
      <div class="wc-attrs">
        ${rvBar("技术", rec.tech, "#f5cf6a")}${rvBar("战术", rec.tac, "#6ea8fe")}
        ${rvBar("体能", rec.phys, "#4ade80")}${rvBar("稳定", rec.stab, "#c4a3f0")}
        ${rvBar("容貌", rec.appearance, "#f0a6c0")}${rvBar("运气", rec.luck, "#e8a24b")}
      </div>
      <p class="wc-luck">🍀 运气揭晓：<b>${rec.luck.toFixed(0)}</b>／100 —— ${luckFlavor(rec.luck)}</p>
      <div class="wc-res">
        <span>人气 <b>${rec.pop.toFixed(1)} 万</b></span>
        <span>资金 <b>${rec.money.toFixed(0)} G</b></span>
        <span>进季后 <b>${rec.playoff_count}</b></span>
        <span>转会 <b>${rec.transfer_count}</b></span>
        <span>休整年 <b>${rec.rest_year_count}</b></span>
      </div>
      <div class="wc-champ">🏆 ${champLine}　｜　亚 ${rec.runnerups}　季 ${rec.thirds}　FMVP ${rec.fmvp_total}</div>
      ${spotHtml}
      <div class="wc-ach-title">解锁成就（${rec.achs.length}）</div>
      <div class="achnames">${achHtml}</div>
      <div class="wc-foot">#IVL模拟器 · demo-v3.0</div>
    </div>`;
}

// 战报文案（纯文本）：复制到剪贴板，方便发帖/分享（剪贴板不可用时回退到弹窗提示）。
function warCardText(rec) {
  const champLine = `夏${rec.champ["夏"]}/秋${rec.champ["秋"]}/IVS${rec.champ["IVS"]}/深渊${rec.champ["深渊"]}`;
  const lines = [
    `【IVL 生涯战报 · ${rec.date}】`,
    `选手：${rec.name}（${rec.idShort}·${rec.role}）`,
    `结局：${rec.final}`,
    `属性 技${rec.tech.toFixed(0)}/战${rec.tac.toFixed(0)}/体${rec.phys.toFixed(0)}/稳${rec.stab.toFixed(0)} · 容貌${rec.appearance.toFixed(0)} · 运气${rec.luck.toFixed(0)}`,
    `人气 ${rec.pop.toFixed(1)}万 · 资金 ${rec.money.toFixed(0)}G · 进季后 ${rec.playoff_count} 次`,
    `冠军 ${champLine} · 亚${rec.runnerups}/季${rec.thirds} · FMVP ${rec.fmvp_total}`,
  ];
  if (rec.spotlights.length) lines.push(`名场面：${rec.spotlights.join("、")}`);
  lines.push(`解锁成就（${rec.achs.length}）：${rec.achs.join("、") || "无"}`);
  lines.push(`#IVL模拟器 demo-v3.0`);
  return lines.join("\n");
}

async function copyWarCard(rec) {
  const txt = warCardText(rec);
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(txt);
      ok = true;
    }
  } catch (e) {
    console.warn("复制到剪贴板失败，回退到手动复制：", e);
  }
  await say("战报文案", `${ok ? `<p class="ok">已复制到剪贴板，去粘贴分享吧！</p>` : `<p class="muted">浏览器未授权剪贴板，请手动全选复制下方文案：</p>`}
    <pre class="warcard-text">${txt.replace(/</g, "&lt;")}</pre>`, "返回结局");
}

/* ----------------------- 全部结局与成就一览（v3.0） --------------------- *
 * 列出全部结局与成就，highlight 玩家本档解锁的项，并标注历史(往期周目)曾解锁的项。 */
async function codexPanel(rec, codex) {
  setStage("结局与成就一览");
  const allEndings = Object.keys(E.ENDING_TEXT);
  const allAch = Object.keys(E.ACH_DESC);
  const endingCells = allEndings.map(name => {
    const here = name === rec.final;
    const ever = (codex.endings || []).includes(name);
    const cls = here ? "cx-here" : (ever ? "cx-ever" : "cx-lock");
    const tag = here ? "本档" : (ever ? "已解锁" : "未解锁");
    return `<div class="cx-cell ${cls}"><div class="cx-name">${name}</div>
      <div class="cx-desc">${(E.ENDING_TEXT[name] || "").replace("玩家ID", rec.playerId)}</div>
      <div class="cx-tag">${tag}</div></div>`;
  }).join("");
  const achCells = allAch.map(name => {
    const here = rec.achs.includes(name);
    const ever = (codex.achs || []).includes(name);
    const cls = here ? "cx-here" : (ever ? "cx-ever" : "cx-lock");
    const tag = here ? "本档" : (ever ? "已解锁" : "未解锁");
    return `<div class="cx-cell ${cls}"><div class="cx-name">${name}</div>
      <div class="cx-desc">${E.ACH_DESC[name] || ""}</div>
      <div class="cx-tag">${tag}</div></div>`;
  }).join("");
  const eUnlocked = (codex.endings || []).length, aUnlocked = (codex.achs || []).length;
  await present({
    title: "全部结局与成就一览",
    sub: `结局 ${eUnlocked}/${allEndings.length} · 成就 ${aUnlocked}/${allAch.length}（含历史周目累计）。高亮为本档解锁。`,
    body: `
      <h3 class="rv">结局（${allEndings.length}）</h3>
      <div class="cx-grid">${endingCells}</div>
      <h3 class="rv">成就（${allAch.length}）</h3>
      <div class="cx-grid">${achCells}</div>`,
    choices: [{ label: "← 返回结局", cls: "primary" }],
  });
}

/* ----------------------- 持久化存档（v3.0 · localStorage） --------------------- *
 * 存当前周目战报 + 累计结局/成就图鉴（历史解锁）。读写失败仅告警、不影响主流程。 */
const SAVE_KEY = "ivl_save_v3";
function loadCodex() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { endings: [], achs: [], last: null, runs: 0 };
    const c = JSON.parse(raw);
    return { endings: c.endings || [], achs: c.achs || [], last: c.last || null, runs: c.runs || 0 };
  } catch (e) {
    console.warn("读取存档失败，使用空图鉴：", e);
    return { endings: [], achs: [], last: null, runs: 0 };
  }
}
function persistRun(rec) {
  const c = loadCodex();
  if (!c.endings.includes(rec.final)) c.endings.push(rec.final);
  for (const a of rec.achs) if (!c.achs.includes(a)) c.achs.push(a);
  c.last = rec;
  c.runs = (c.runs || 0) + 1;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(c));
  } catch (e) {
    console.warn("写入存档失败（不影响本局）：", e);
  }
  return c;
}
function rvBar(k, v, c) { return `<div class="rvbar"><span>${k}</span><div class="rvtrack"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div><b>${v.toFixed(0)}</b></div>`; }
// 运气结局揭晓（v6.5《demov2.2feedback》）：运气全程隐藏，仅在生涯落幕时把本轮数值与一句注脚告诉玩家。
function luckFlavor(v) {
  if (v >= 85) return "天选之子，关键时刻总有人替你兜底。";
  if (v >= 65) return "运气站在你这边，顺风局里如鱼得水。";
  if (v >= 40) return "不好不坏，多数时候靠的还是真本事。";
  if (v >= 20) return "时运多舛，不少硬仗都是逆着风打下来的。";
  return "命途多舛——能走到这里，全凭一身骨气。";
}

/* ============================== 启动 ================================== */
async function boot() {
  const codex = loadCodex();
  const allE = Object.keys(E.ENDING_TEXT).length, allA = Object.keys(E.ACH_DESC).length;
  const hasLast = codex.last && codex.last.v === 3;
  const progress = codex.runs
    ? `<p class="muted">📂 本地存档：已征战 <b>${codex.runs}</b> 段生涯，解锁结局 <b>${codex.endings.length}/${allE}</b>、成就 <b>${codex.achs.length}/${allA}</b>。</p>`
    : "";
  const choice = await present({
    title: "IVL 模拟器 · 可玩切片 demo-v3.0",
    body: `
      <p>欢迎来到《IVL 模拟器》可玩垂直切片。你将扮演一名《第五人格》职业电竞选手，从青训出道，征战 7 个赛年。</p>
      <ul class="intro">
        <li><b>训练养成 + 突发事件</b>：23 件训练事件，选项不预告数值；<b>容貌</b>越高越容易触发商业/漫展类邀约。</li>
        <li><b>赛事模拟</b>：夏/秋季赛季后赛、IVS、深渊全球赛（含季军赛）；<b>赛事名场面</b>彩蛋随发挥触发。</li>
        <li><b>伤病系统</b>：临时伤病 / 腱鞘炎 / 伤重退役，靠护腕·体检·理疗·商业休整对抗。</li>
        <li><b>年度商店</b>：每年随机上架，<b>8% 概率</b>现身后悔药 / 庄园密信（<b>减免所有冠军疲劳</b>）/ 骨龄逆转血清。</li>
        <li><b>该你上场了！</b>：季后赛 / 深渊总决赛由你<b>亲手投出</b>临场状态，六档发挥即时反馈。</li>
        <li><b>生涯战报卡</b>（可截图分享）+ <b>全部结局与成就一览</b> + <b>本地存档</b>（v3.0 新增）。</li>
      </ul>
      ${progress}
      <p class="muted">数值与已回归的蒙特卡洛引擎 v2.5 同源（《数值设计 v6.0》/《策划案 v7.0》/《文案设计 v2.0》）。</p>`,
    choices: hasLast
      ? [{ label: "创建角色", cls: "primary" }, { label: "📜 查看上局生涯战报", cls: "ghost" }]
      : [{ label: "创建角色", cls: "primary" }],
  });
  if (choice === 1 && hasLast) {
    while (true) {
      const c2 = await present({
        title: "上局生涯战报",
        sub: `${codex.last.date} · ${codex.last.name}`,
        body: warCardHtml(codex.last, codex.last.kind === "forced"),
        choices: [{ label: "🏆 全部结局与成就", cls: "ghost" }, { label: "← 返回，开始新生涯", cls: "primary" }],
      });
      if (c2 === 0) { await codexPanel(codex.last, codex); continue; }
      break;
    }
  }
  await characterCreation();
  await career();
}

async function gameLoop() {
  while (true) {
    try {
      await boot();
    } catch (err) {
      console.error("本局发生未预期错误，已记录并重开：", err);
      flash("发生异常，已重新开始");
      logLines = []; P = null; renderHUD();
    }
  }
}
window.addEventListener("DOMContentLoaded", () => { renderHUD(); gameLoop(); });

