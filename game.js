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
 *      完整选手 ID = 队伍名称_玩家ID（如 Nova_Rookie，均为示例虚构名）；转会后可重新输入队名。
 * feedback15 沿用：突发事件初始选项不显示数值，选完才公布结果。
 * ===========================================================================*/
const E = window.IVL;
const $ = (sel) => document.querySelector(sel);

// v4.0：战报卡二维码指向的体验地址（《demov3.0feedback·结算界面·二维码》）。部署后可替换为正式短链。
const GAME_URL = "https://ivl-sim.example.com";

/* 称号显示口径（v6.4 / v1.2 修复）：严格按定位取值——求生者→「人皇」、监管者→「屠皇」，
 * 不再出现"监管者在生涯回顾中被误显示为人皇"的串号 bug。 */
function kingTitle(role) { return role === "监管者" ? "屠皇" : "人皇"; }
// 生涯回顾 / 结局界面的身份短名：榜前身份按定位取人皇/屠皇，其余按引擎身份原样。
function idShort(p) { return p.identity === "人皇" ? kingTitle(p.role) : p.identity; }

let P = null;
let curYear = 1, curAge = 18;
let curStage = "—";
let logLines = [];
let gameTeams = null;          // v4.0：本局随机生成的各赛区 NPC 队名池
let shopPreview = null;        // v4.0：购物车中属性商品的预览增量 {tech,tac,phys,stab}

/* v4.0：年度进度条（《demov3.0feedback》）——一年内的阶段顺序与当前所处位置。 */
const YEAR_PHASES = ["季前训练", "夏季赛", "IVS", "夏秋训练", "秋季赛", "深渊前训练", "深渊", "赛季末"];
let yearPhase = 0;
function setYearPhase(i) { yearPhase = i; renderHUD(); }

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
function bar(label, val, color, pv) {
  const v = Math.max(0, Math.min(100, val));
  const prev = (pv && pv > 0) ? ` <span class="pv">(+${pv.toFixed(0)})</span>` : "";
  const ghost = (pv && pv > 0) ? `<i class="track-ghost" style="width:${Math.max(0, Math.min(100, val + pv))}%;background:${color}"></i>` : "";
  return `<div class="stat">
    <div class="stat-top"><span>${label}</span><b>${val.toFixed(0)}${prev}</b></div>
    <div class="track">${ghost}<i style="width:${v}%;background:${color}"></i></div>
  </div>`;
}
// 年度进度条（v4.1，demov4.0feedback·赛年进度条）：一条随时间向前推进的线，
// 只标出"当前走到了哪个阶段"，不再把每年的事件逐条列出。
function yearProgressHtml() {
  const n = YEAR_PHASES.length;
  const cur = Math.max(0, Math.min(n - 1, yearPhase));
  const pct = n > 1 ? (cur / (n - 1)) * 100 : 0;
  const ticks = YEAR_PHASES.map((name, i) => {
    const left = n > 1 ? (i / (n - 1)) * 100 : 0;
    const cls = i < cur ? "done" : (i === cur ? "on" : "");
    return `<span class="yp-tick ${cls}" style="left:${left}%" title="${name}"></span>`;
  }).join("");
  return `<div class="yearprog">
    <div class="yp-head"><span class="yp-yr">赛年 ${curYear}/7</span><span class="yp-now">${YEAR_PHASES[cur]}</span></div>
    <div class="yp-line"><i class="yp-fill" style="width:${pct}%"></i>${ticks}<span class="yp-marker" style="left:${pct}%"></span></div>
  </div>`;
}
// 状态 tag（伤病 / 商业休整 / 道具 buff 等）：HUD 与常规赛/季后赛/深渊左侧体力面板共用（demov4.1feedback）。
function statusTagsHtml() {
  if (!P) { return []; }
  const t = [];
  if (P.negative_news) { t.push(`<span class="db">负面新闻</span>`); }
  if (P.teno_active) { t.push(`<span class="db">腱鞘炎</span>`); }
  if (P.temp_active) { t.push(`<span class="db">临时伤病</span>`); }
  if (P.rest_active) { t.push(`<span class="db rest">商业休整</span>`); }
  if (P.has_wrist) { t.push(`<span class="db buff">护腕</span>`); }
  if (P.has_checkup) { t.push(`<span class="db buff">体检</span>`); }
  if (P.redo_token > 0) { t.push(`<span class="db rare">后悔药×${P.redo_token}</span>`); }
  if (P.has_seal) { t.push(`<span class="db rare">庄园密信</span>`); }
  if (P.serum_active) { t.push(`<span class="db rare">逆龄血清</span>`); }
  if (P.nextGameBuff) { t.push(`<span class="db buff">下场F+${P.nextGameBuff.toFixed(0)}</span>`); }
  if (P.nextNoBadRoll) { t.push(`<span class="db buff">🎴下场不失常</span>`); }
  return t;
}
// 左侧体力面板（常规赛/季后赛/深渊整屏 overlay 共用）：体力条 + 状态 tag + 本场体力消耗（demov4.1feedback）。
function staminaPanelHtml(cost) {
  if (!P) { return ""; }
  const max = P.stamina_max;
  const pct = Math.max(0, Math.min(100, (P.stamina / max) * 100));
  const color = P.stamina < 20 ? "#f47272" : (P.stamina < 30 ? "#e8a24b" : "#4ade80");
  const tags = statusTagsHtml();
  const costHtml = (cost != null) ? `<span class="stam-cost">每场约 −${cost}</span>` : "";
  return `<div class="stam-top"><span class="stam-lab">体力</span><b class="mono">${Math.round(P.stamina)} / ${Math.round(max)}</b>${costHtml}</div>
    <div class="stam-track"><i style="width:${pct}%;background:${color}"></i></div>
    ${tags.length ? `<div class="stam-tags">${tags.join("")}</div>` : ""}`;
}
function renderHUD() {
  // demov4.1feedback·初始界面：无角色时（启动菜单/创建角色/图鉴）左侧边栏为空白，直接隐藏整条边栏。
  if (typeof document !== "undefined" && document.body) { document.body.classList.toggle("no-player", !P); }
  const h = $("#hud");
  if (!h) return;
  if (!P) { h.innerHTML = ""; return; }
  const stMax = P.stamina_max;
  const stPct = Math.max(0, Math.min(100, (P.stamina / stMax) * 100));
  const stColor = P.stamina < 20 ? "#f47272" : (P.stamina < 30 ? "#e8a24b" : "#4ade80");
  const champs = `夏${P.champ["夏"]} 秋${P.champ["秋"]} IVS${P.champ["IVS"]} 深渊${P.champ["深渊"]}`;
  const debuffs = statusTagsHtml();

  h.innerHTML = `
    <div class="hud-id">
      <div class="avatar">${(P.name || "?").slice(0, 1)}</div>
      <div>
        <div class="pname">${P.name} <span class="pos">${P.role}${P.identity === "人皇" ? "·" + kingTitle(P.role) : ""}</span></div>
        <div class="pmeta">${idShort(P)} · ${curAge}岁 · 赛年 ${curYear}/7</div>
        <div class="pstage">阶段：${curStage}</div>
      </div>
    </div>
    ${yearProgressHtml()}
    <div class="stamina">
      <div class="stat-top"><span>体力</span><b>${P.stamina.toFixed(0)} / ${stMax.toFixed(0)}</b></div>
      <div class="track big"><i style="width:${stPct}%;background:${stColor}"></i></div>
    </div>
    <div class="stats">
      ${bar("技术", P.tech, "#f5cf6a", shopPreview && shopPreview.tech)}
      ${bar("战术", P.tac, "#6ea8fe", shopPreview && shopPreview.tac)}
      ${bar("体能", P.phys, "#4ade80", shopPreview && shopPreview.phys)}
      ${bar("稳定", P.stab, "#c4a3f0", shopPreview && shopPreview.stab)}
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
  liveAchCheck();   // demov4.1feedback·成就弹窗：每次状态刷新检测里程碑成就，达成即时弹出

}

const INV_META = {
  "柠檬水": { slot: "stam", val: 30, label: "🥤体力+30" },
  "筋膜枪": { slot: "stam", val: 60, label: "🔫体力+60" },
  "好运签": { slot: "fbuff", val: 8, noBadRoll: true, label: "🎴下场F+8·不失常" },
  "定制应援物料": { slot: "fbuff", val: 5, pop: 0.5, label: "📣下场F+5" },
  "战术分析仪": { slot: "fbuff", val: 6, label: "📊下场F+6" },
  "理疗康复套餐": { slot: "heal", label: "💊清伤病" },
  // demov4.1feedback·稀缺商品：稀缺道具入包，点击激活本赛年效果。
  "后悔药": { slot: "redo", rare: true, label: "🔁本赛年1次重打额度" },
  "庄园密信": { slot: "seal", rare: true, label: "✉️深渊前清冠军疲劳" },
  "骨龄逆转血清": { slot: "serum", rare: true, label: "🧬本赛年成长不衰减" },
};
// 道具图标（SVG path，供 HUD 全局背包 / 季后赛背包复用，统一比赛界面样式）。
function invIcon(name) {
  const m = INV_META[name] || {};
  if (m.slot === "stam") return '<path d="M8 2h8l-1 6H9z"/><path d="M9 8c-1 4-1 8 0 12h6c1-4 1-8 0-12"/>';
  if (m.slot === "heal") return '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>';
  if (m.slot === "redo") return '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
  if (m.slot === "seal") return '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>';
  if (m.slot === "serum") return '<path d="M9 3h6M10 3v6l-4 8a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-8V3"/>';
  if (m.noBadRoll) return '<path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4z"/>';
  if (m.slot === "fbuff") return '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
  return '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/>';
}
function bagItemCardHTML(name, n, usable) {
  const meta = INV_META[name] || {};
  const desc = (meta.label || "").replace(/^[^\u4e00-\u9fa5A-Za-z]+/, "");
  return `<div class="bagx-item${usable ? "" : " disabled"}">`
    + `<div class="bagx-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${invIcon(name)}</svg></div>`
    + `<div class="bagx-body"><div class="nm">${name}</div><div class="desc">${desc}</div></div>`
    + `<div class="bagx-cnt mono">×${n}</div>`
    + `<button class="bagx-use" data-n="${name}" ${usable ? "" : "disabled"}>使用</button></div>`;
}
// 全局背包弹窗（demov4.0feedback·背包改良）：HUD 不再内联罗列道具按钮，改为点开弹窗使用。
function ensureGlobalBag() {
  let m = document.getElementById("gbag");
  if (m) return m;
  m = document.createElement("div");
  m.id = "gbag"; m.className = "bagx-modal";
  m.innerHTML = `<div class="bagx-sheet">
    <div class="bagx-head"><div><div class="ttl">背包 · 道具</div><div class="sub">点击「使用」立即对你生效</div></div><button class="bagx-x" id="gbagX" aria-label="关闭">×</button></div>
    <div class="bagx-list" id="gbagList"></div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("show"); });
  m.querySelector("#gbagX").onclick = () => m.classList.remove("show");
  return m;
}
function renderGlobalBag() {
  const list = document.getElementById("gbagList"); if (!list) return;
  const items = Object.entries(P.inv || {}).filter(([, n]) => n > 0);
  list.innerHTML = items.length
    ? items.map(([name, n]) => bagItemCardHTML(name, n, true)).join("")
    : `<div class="bagx-empty">背包空 · 可在年度商店采购消耗品</div>`;
  list.querySelectorAll(".bagx-use").forEach(b => { b.onclick = () => { useItem(b.dataset.n); renderGlobalBag(); }; });
}
function openGlobalBag() { ensureGlobalBag(); renderGlobalBag(); document.getElementById("gbag").classList.add("show"); }
function renderInventory() {
  const el = $("#inv");
  if (!el) return;
  const total = Object.values(P.inv || {}).reduce((s, n) => s + (n > 0 ? n : 0), 0);
  el.innerHTML = `<button class="bagbtn" id="hudBagBtn" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    <span class="bagbtn-lab">背包</span><span class="bagbtn-badge">${total}</span></button>`;
  $("#hudBagBtn").onclick = openGlobalBag;
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
  } else if (m.slot === "redo") {
    // 后悔药：本赛年 +1 次重打额度（输一场可立刻重打）。
    P.redo_token += 1;
    flash(`使用${name}：本赛年 +1 次重打额度（共 ${P.redo_token} 次）`);
  } else if (m.slot === "seal") {
    if (P.has_seal) { flash("庄园密信已生效，无需重复使用"); return; }
    P.has_seal = true;
    flash(`使用${name}：进深渊前将清零本年累积的冠军疲劳`);
  } else if (m.slot === "serum") {
    if (P.serum_active) { flash("骨龄逆转血清已生效"); return; }
    P.serum_active = true; P.used_serum = true;   // v4.0 返老还童追踪：点击使用即记一次
    flash(`使用${name}：本赛年技术/战术/体能成长衰减归零`);
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

/* v4.0 成就弹出条（《demov3.0feedback·新增成就弹出条》）：右下角弹出「达成成就 xxx」，
 * 颜色随成就分级（白金/黄金/白银/青铜）变化，5 秒后自动关闭。 */
const ACH_TIER_CLASS = { "白金": "t-plat", "黄金": "t-gold", "白银": "t-silver", "青铜": "t-bronze" };
/* demov4.1feedback·成就弹窗：达成的一刻就弹，而不是结局才弹。
 * 只对「单调成立、达成即锁定」的里程碑成就做即时弹（避免依赖生涯终局/0 冠等末态条件的成就提前误弹）。
 * 金满贯依赖深渊终局判定，仍在结局阶段统一弹出。 */
const INSTANT_ACH = new Set([
  "大满贯", "洲际之巅", "冠军选手", "FMVP", "专属王朝", "电竞白月光", "全能选手", "操作手", "战队大脑",
  "大器晚成", "浪迹天涯", "轻伤不下火线", "绝活信仰玩家", "返老还童", "庄园快信", "逆转未来", "万能螺丝",
  "光荣的荆棘路", "百炼成钢", "年度最佳演绎",
]);
function liveAchCheck() {
  if (!P) { return; }
  if (!P._poppedAchs) { P._poppedAchs = new Set(); }
  let a;
  try {
    a = E.computeAchievements(P, false, false, null);   // 生涯进行中：fullCareer/grandSlam/forced 均按未完成处理
  } catch (e) {
    console.warn("即时成就检测失败：", e);
    return;
  }
  for (const name of INSTANT_ACH) {
    if (a[name] && !P._poppedAchs.has(name)) { P._poppedAchs.add(name); achToast(name); }
  }
}
function achStack() {
  let s = document.getElementById("achstack");
  if (!s) { s = document.createElement("div"); s.id = "achstack"; s.className = "achstack"; document.body.appendChild(s); }
  return s;
}
function achToast(name) {
  const tier = E.achTier(name);
  const el = document.createElement("div");
  el.className = `achpop ${ACH_TIER_CLASS[tier] || "t-bronze"}`;
  el.innerHTML = `<span class="ap-icon">🏅</span><span class="ap-body"><b class="ap-head">达成成就 · ${tier}</b><span class="ap-name">${name}</span></span>`;
  achStack().appendChild(el);
  (window.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 5000);
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
  P.stamina = P.stamina_max;                 // v4.0：开局即满体力（不再显示 0）
  gameTeams = E.generateTeams(P.teamName);   // v4.0：生成本局各赛区 NPC 队名池
  yearPhase = 0;
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
  else comp = "经理在战术板上写下两个字：深渊。这一年，向小组出线乃至全球总冠军发起冲击。";
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
let curIntensity = "正常";

// v4.0：把当前强度下的效果与消耗比例直接列进选项（《demov3.0feedback·训练》）。
function fmtN(n) { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? "" + r : r.toFixed(1); }
function trainEffectDesc(proj, intensity) {
  // demov4.1feedback·训练：基础数值始终按「正常」展示，切换强度仅追加（+20%）/（−20%）标注，
  // 实际成长口径（强度倍率 + 年龄衰减）由 engine.applyTraining 内部结算，展示不再随强度缩放。
  const t = E.CONFIG.TRAIN[proj];
  const pct = intensity === "高强度" ? "（+20%）" : (intensity === "休养" ? "（−20%）" : "");
  const parts = [];
  if (t.tech) parts.push(`技术+${fmtN(t.tech)}`);
  if (t.tac) parts.push(`战术+${fmtN(t.tac)}`);
  if (t.phys) parts.push(`体能+${fmtN(t.phys)}`);
  if (t.stab) parts.push(`稳定+${fmtN(t.stab)}`);
  if (t.pop) parts.push(`人气+${fmtN(t.pop)}`);
  if (t.moneyByPop) parts.push(`资金+${fmtN(E.streamMoneyGain(P))}`);
  if (proj === "休息") { parts.push(`体力+${fmtN(-t.cost)}`); return parts.join("，"); }
  parts.push(`体力-${fmtN(t.cost)}`);
  return parts.join("，") + pct;
}

function trainProjsHtml() {
  return Object.keys(E.CONFIG.TRAIN).map(proj => {
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[curIntensity][1];
    const need = proj !== "休息" && P.stamina < cost;
    return `<button class="trainproj ${need ? "disabled" : ""}" data-proj="${proj}" ${need ? "disabled" : ""}>
      <span class="tp-name">${proj}</span><span class="tp-info">${trainEffectDesc(proj, curIntensity)}</span>
      ${need ? `<span class="tp-need">体力不足</span>` : ""}</button>`;
  }).join("");
}
function trainBody() {
  return `
    <div class="intensity">强度：
      ${["休养", "正常", "高强度"].map(i => `<button class="intbtn ${i === curIntensity ? "on" : ""}" data-int="${i}">${i}</button>`).join("")}
      <span class="int-hint">${curIntensity === "高强度" ? "效果/消耗整体 +20%" : (curIntensity === "休养" ? "效果/消耗整体 −20%" : "标准强度")}${P.rest_active ? " ·休整收益×0.8" : ""}</span></div>
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
    // demov4.1feedback·体力：体力为 0 时不进行任何活动，突发事件也不触发。
    if (P.stamina > 0 && Math.random() < E.CONFIG.TRAIN_EVENT_P) { await trainingEvent(); renderHUD(); }
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

/* ============================== 商店 ================================== *
 * v4.0《demov3.0feedback·商店》：
 *   · 物品余量用「库存N」表述；
 *   · 资金不足时按钮文字改为「资金不足」（而非仅置灰）；
 *   · 删除商店下方的大段说明；
 *   · 新增购物车：先加入再统一结算，购物车内可随时增删；属性类商品入车后在属性条旁展示 (+n) 预览，
 *     删除则移除预览，结算才正式生效（资金统一在结算时扣除）。 */
// 把一件商品正式购入并生效（结算时调用）。
function applyPurchase(it) {
  P.money -= it.price; it.left -= 1;
  if (it.kind === "attr") { for (const [k, v] of Object.entries(it.eff)) P[k] = Math.min(100, P[k] + v); P._clamp(); }
  else if (it.kind === "wrist") { P.has_wrist = true; }
  else if (it.kind === "checkup") { P.has_checkup = true; }
  else if (it.kind === "clear") { P.negative_news = false; }
  // demov4.1feedback·稀缺商品：后悔药/庄园密信/骨龄逆转血清改为放入背包，点击「使用」才生效。
  else if (it.kind === "redo" || it.kind === "seal" || it.kind === "serum") { P.inv[it.name] = (P.inv[it.name] || 0) + 1; }
  else if (it.kind === "consume") { P.inv[it.name] = (P.inv[it.name] || 0) + 1; }
  pushLog(`商店购买：${it.name}（−${it.price}G）`);
}

async function shopPhase() {
  setStage("年度商店");
  // 当年生效的道具/稀缺效果于赛年开始（进商店）随库存刷新一并重置（道具不跨年）。
  P.has_wrist = false; P.has_checkup = false; P.redo_token = 0; P.has_seal = false; P.serum_active = false;
  P.stamina = P.stamina_max;            // v4.0：进商店（开局/每年）体力直接给满
  renderHUD();
  const stock = E.buildShopStock();
  const hasRare = stock.some(it => it.rare);
  const groups = ["体力恢复", "伤病防护", "临场爆发", "属性成长", "舆论处理", "极其稀缺"];
  const risk = injuryRiskLine();
  const cart = new Map();                // stock 下标 -> 数量
  shopPreview = null;
  const cartQty = (i) => cart.get(i) || 0;
  const cartTotal = () => { let s = 0; for (const [i, q] of cart) s += stock[i].price * q; return s; };
  const updatePreview = () => {
    const pv = { tech: 0, tac: 0, phys: 0, stab: 0 }; let any = false;
    for (const [i, q] of cart) {
      const it = stock[i];
      if (it.kind === "attr") for (const [k, v] of Object.entries(it.eff)) { if (pv[k] != null) { pv[k] += v * q; any = true; } }
    }
    shopPreview = any ? pv : null;
    renderHUD();
  };
  await new Promise((resolve) => {
    const addCart = (i) => { const it = stock[i]; if (it.left - cartQty(i) <= 0) return; if (P.money < cartTotal() + it.price) return; cart.set(i, cartQty(i) + 1); updatePreview(); render(); };
    const decCart = (i) => { const q = cartQty(i); if (q <= 1) cart.delete(i); else cart.set(i, q - 1); updatePreview(); render(); };
    const checkout = () => { for (const [i, q] of cart) for (let k = 0; k < q; k++) applyPurchase(stock[i]); cart.clear(); shopPreview = null; renderHUD(); resolve(); };
    const render = () => {
      const total = cartTotal();
      const sections = groups.map(g => {
        const items = stock.filter(it => it.group === g);
        if (!items.length) return "";
        const rare = g === "极其稀缺";
        const rows = items.map((it) => {
          const gi = stock.indexOf(it);
          const q = cartQty(gi);
          const avail = it.left - q;
          const sold = it.left <= 0;
          const canAfford = P.money >= total + it.price && avail > 0;
          let ctrl;
          if (sold) ctrl = `<button class="si-buy" disabled>售罄</button>`;
          else if (q > 0) ctrl = `<div class="si-step"><button class="si-mn" data-dec="${gi}">−</button><span class="si-q">${q}</span><button class="si-pl" data-inc="${gi}" ${canAfford ? "" : "disabled"}>＋</button></div>`;
          else if (!canAfford) ctrl = `<button class="si-buy" disabled>资金不足</button>`;
          else ctrl = `<button class="si-buy" data-inc="${gi}">加入购物车</button>`;
          return `<div class="shoprow ${rare ? "rare" : ""} ${sold ? "sold" : ""}">
            <div class="si-main"><div class="si-name">${rare ? `<span class="si-rarebadge">限定</span>` : ""}${it.name}</div><div class="si-tag">${it.tag}</div><div class="si-desc">${it.desc}</div></div>
            <div class="si-price">${it.price}G</div><div class="si-left">库存${avail}</div>
            ${ctrl}
          </div>`;
        }).join("");
        return `<div class="shopgroup ${rare ? "rare" : ""}"><div class="sg-title">${rare ? "✦ 极其稀缺（限定爆品）" : g}</div>${rows}</div>`;
      }).join("");
      const cartItems = [...cart.entries()].filter(([, q]) => q > 0);
      const cartHtml = cartItems.length
        ? cartItems.map(([i, q]) => `<span class="cart-chip">${stock[i].name}${q > 1 ? "×" + q : ""}<button class="cart-rm" data-rm="${i}">✕</button></span>`).join("")
        : `<span class="cart-empty">购物车空——选择商品「加入购物车」，可随时增删，最后统一结算。</span>`;
      const canProceed = (total === 0) || (P.money >= total);
      const cartCount = cartItems.reduce((s, [, q]) => s + q, 0);
      main().innerHTML = `
        <div class="panel-head"><h2>赛年 ${curYear} · 年度商店</h2>
          <p class="sub">资金 <b>${P.money.toFixed(0)} G</b></p></div>
        <div class="panel-body">
          ${risk ? `<div class="riskbar ${risk.level === "high" ? "ko" : "warn"}">⚠ 伤病风险预警：${risk.text}</div>` : ""}
          ${hasRare ? `<div class="rarebar">✦ 今年货架上出现了<b>极其稀缺商品</b>——8% 概率才会现身，错过要等下一年。</div>` : ""}
          <div class="cartbar">
            <div class="cart-head">
              <span class="cart-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>购物车</span>
              <span class="cart-count">${cartCount} 件</span>
            </div>
            <div class="cart-list">${cartHtml}</div>
            <div class="cart-foot"><span>合计 <b>${total} G</b></span><span class="cart-bal">结算后余额 <b>${(P.money - total).toFixed(0)} G</b></span></div>
          </div>
          <div class="shop">${sections}</div>
        </div>
        <div class="choices"><button class="choice primary" id="shopCheckout" ${canProceed ? "" : "disabled"}><span class="cl">${total > 0 ? `结算（${total}G）并进入训练` : "不采购，进入训练"}</span></button></div>`;
      main().querySelectorAll(".si-buy[data-inc]").forEach(b => { b.onclick = () => addCart(+b.dataset.inc); });
      main().querySelectorAll(".si-pl[data-inc]").forEach(b => { if (!b.disabled) b.onclick = () => addCart(+b.dataset.inc); });
      main().querySelectorAll(".si-mn[data-dec]").forEach(b => { b.onclick = () => decCart(+b.dataset.dec); });
      main().querySelectorAll(".cart-rm[data-rm]").forEach(b => { b.onclick = () => { cart.delete(+b.dataset.rm); updatePreview(); render(); }; });
      $("#shopCheckout").onclick = () => { if (canProceed) checkout(); };
    };
    render();
  });
  shopPreview = null; renderHUD();
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
      let r = E.rollFluct(V, noBad);
      let fb = E.diceTier(r, V);
      // v4.0 好运签 bug 修复加固：保证生效时绝不落入失常档（tier<3），双保险钳制到稳定下边界。
      if (noBad && fb.tier < 3) { r = E.noBadFloor(V); fb = E.diceTier(r, V); }
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
  const { oppBonus = 0, dayFirst = false, keyMatch = false, oppName = "" } = opts;
  if (dayFirst) { P.stamina = E.matchStartStamina(P); P.fired_events = new Set(); }
  if (!P.fired_events) P.fired_events = new Set();
  const staCost = E.gameCost(stage);
  const staBefore = P.stamina;
  P.stamina = Math.max(0, P.stamina - staCost);   // 体力下限 0（demov4.1feedback）
  P._lastStaCost = Math.round(staBefore - P.stamina);  // 本场实际体力消耗（左侧体力条展示用）
  const fainted = P.stamina <= 0;
  renderHUD();

  let fdelta = 0, eventNarr = null;
  // 常规赛：本阶段最多触发一次比赛期事件（demov2.1feedback2）
  const ev = E.rollMatchEvent(P, { atMostOne: stage === "常规" });
  if (ev) {
    if (ev.needChoice) {
      // v4.2：常规赛整屏 overlay 用自己的弹窗呈现赛中事件（opts.choose 注入），其余阶段仍走全屏 present()。
      const idx = await (opts.choose || choose)(`赛中事件 · ${ev.key}`, `<p class="flavor">${ev.flavor}</p>`,
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
      P.redo_token -= 1; P.used_redo = true;   // 逆转未来追踪：后悔药真正生效一次
      restore(s0);
      renderHUD();
      pushLog("后悔药生效：重打这一场。", "good");
      a = await runAttempt(true);
    }
  }
  const { F, cheer, team, opp, win } = a;

  // v4.0：BP 冲突选绝活——若本场获胜，概率追加人气（《demov3.0feedback·比赛突发事件》）。
  if (P.bp_signature_pending) {
    if (win && Math.random() < 0.6) { P.addPop(3); pushLog("绝活坚守且取胜：人气 +3。", "good"); renderHUD(); }
    P.bp_signature_pending = false;
  }

  const tags = E.reasonTags(P, { stage, win, keyMatch, F, opp, team, cheer, fainted, year: curYear, age: curAge });
  const reason = E.pickReason(tags, win);
  P.nextGameBuffUsed = false;

  // v6.0 赛事名场面（纯叙事彩蛋）：失常 = 随机浮动落 1-2 档（r < −V/3）；命中则结算并弹出彩蛋页。
  const abnormal = a.rfloat < -a.V / 3;
  const spot = E.rollSpotlight(P, win, abnormal);
  if (spot) {
    renderHUD();
    pushLog(`赛事名场面 · ${spot.name}（人气 +2、稳定 +2）`, "good");
    await (opts.say || say)(spot.title, `<p class="flavor">${spot.text}</p><p class="ok">这一幕被定格为赛事名场面 —— 人气 +2、稳定 +2。</p>`, "笑纳这波热度");
  }

  const vs = oppName ? `<b class="vs">${P.teamName} VS ${oppName}</b>　` : "";
  let line = `${vs}${win ? "✔ 胜" : "✘ 负"}　你 ${F.toFixed(0)}（队 ${team.toFixed(0)}）vs 对手 ${opp.toFixed(0)}　体力 −${staCost}`;
  if (fainted) line = `${vs}✘ 体力清零·晕倒判负　对手 ${opp.toFixed(0)}`;
  if (spot) line += `　🎬 名场面「${spot.name}」`;
  return { win, F, team, opp, line, eventNarr, reason, fainted, spot, staCost, oppName };
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

// 常规赛：9 场。v4.2 起整屏「转播台」UI（复刻 UI设计/demo11-常规赛A-转播台.html），
// 队名/队标/数值取真实游戏数据，赛果由真实 playMatch 结算。返回 {rank, inPlayoff, wins}。
async function regularSeason(kind) {
  setStage(`${kind}季赛·常规赛`);
  P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
  renderHUD();                 // 进入比赛周期即时刷新体力（demov2.1feedback2）
  const res = await runRegularSeasonScreen(kind);   // {rank, inPlayoff, wins}
  P.recent_perf = res.wins / 9.0;
  pushLog(`${kind}季赛常规赛：${res.wins}胜，第 ${res.rank} 名，${res.inPlayoff ? "晋级季后赛" : "无缘季后赛"}。`, res.inPlayoff ? "good" : "bad");
  return res;
}

/* =============================================================================
 * 常规赛「转播台」整屏 overlay（复刻 demo11；CSS 全部前缀作用域于 #rs-root，元素 id 前缀 rs-）。
 * 左：比赛进行区（对阵 + 突发事件弹窗）；右：本队战报 feed。赛果走真实引擎 playMatch，
 * 突发事件 / 名场面通过 opts.choose / opts.say 注入到本屏弹窗，避免与全屏 present() 冲突。
 * 完成（点「进入季后赛 / 继续训练」）后销毁 overlay 并 resolve {rank, inPlayoff, wins}。
 * ===========================================================================*/
function rsOverlayHTML(kind) {
  return `<div id="rs-root">
  <div class="topbar">
    <div class="brand">
      <span class="logo">IVL</span>
      <div>
        <div class="ttl">${kind}季赛 · <b>常规赛</b></div>
        <div class="sub">REGULAR SEASON · 9 场 BO3 · 前 6 进季后赛</div>
      </div>
    </div>
    <div class="spacer"></div>
    <button class="tbtn" id="rs-bagBtn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      背包<span class="badge" id="rs-bagBadge">0</span>
    </button>
    <button class="tbtn" id="rs-attrBtn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4z"/></svg>
      个人属性
    </button>
    <div class="idchip"><span class="dot"></span><div><div class="nm" id="rs-idTeam"></div><div class="rk" id="rs-idRole"></div></div></div>
  </div>

  <div class="layout">
    <section class="arena">
      <div class="arena-head">
        <div><div class="lab">LIVE · 比赛进行中</div><h2>本队对战 · 常规赛</h2></div>
        <div class="rec">战绩 <b id="rs-recText">0 - 0</b><br><span class="mono" id="rs-progText" style="color:var(--dim)">MATCH 0 / 9</span></div>
      </div>
      <div class="progress"><div class="bar"><i id="rs-progBar"></i></div></div>
      <div class="rs-stam" id="rs-stamPanel"></div>
      <div class="arena-body">
        <div class="mc-meta">
          <span class="mc-rd" id="rs-mcRd">第 1 轮</span>
          <span class="mc-bo">单循环 · BO3</span>
          <span class="mc-code mono" id="rs-mcCode">R1</span>
        </div>
        <div class="versus">
          <div class="vteam player" id="rs-vMe">
            <div class="crest"></div><div class="nm"></div><div class="you">YOUR TEAM</div>
          </div>
          <div class="vsmid" id="rs-vsMid">
            <div class="bo">BEST OF 3</div>
            <div class="score mono" id="rs-vScore"></div>
            <div class="vs" id="rs-vsWord">VS</div>
          </div>
          <div class="vteam" id="rs-vOp"><div class="crest"></div><div class="nm"></div></div>
        </div>
        <div class="buffrow" id="rs-buffRow"></div>
        <div class="mstatus" id="rs-mStatus">点击「开始本轮」结算这场 BO3 · 也可先在背包里使用加成道具</div>
      </div>
      <div class="actions"><div class="inner">
        <button class="bigbtn" id="rs-continueBtn" style="display:none">进入季后赛 →</button>
        <button class="bigbtn" id="rs-actBtn">开始第 1 轮 →</button>
        <button class="bigbtn skip" id="rs-skipBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          一键跳过 · 直达战报
        </button>
        <div class="hint" id="rs-actHint"></div>
      </div></div>
    </section>

    <aside class="reportcol">
      <div class="rc-head"><div class="lab">MATCH REPORT</div><h2>本队战报</h2></div>
      <div class="feed" id="rs-feed"><div class="feed-empty" id="rs-feedEmpty">尚无战报</div></div>
    </aside>
  </div>

  <div class="modal" id="rs-evtModal"><div class="sheet">
    <div class="evt-stage">
      <div class="evt-ey">MATCH EVENT · 突发状况</div>
      <div class="evt-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div class="evt-ttl" id="rs-evtTtl"></div>
      <div class="evt-rd" id="rs-evtRd"></div>
    </div>
    <div class="evt-desc" id="rs-evtDesc"></div>
    <div class="evt-opts" id="rs-evtOpts"></div>
  </div></div>

  <div class="modal" id="rs-bagModal"><div class="sheet">
    <div class="sheet-head"><div><div class="ttl">背包 · 加成道具</div><div class="sub">点击「使用」对当前这场比赛生效</div></div><button class="x" id="rs-bagX" aria-label="关闭">×</button></div>
    <div class="bag-tip" id="rs-bagTip">道具仅在本轮开打前可用</div>
    <div class="bag-list" id="rs-bagList"></div>
  </div></div>

  <div class="modal" id="rs-qualifyModal"><div class="sheet">
    <div class="sheet-head"><div><div class="ttl">晋级情况 · 常规赛最终排名</div><div class="sub">前 6 名晋级季后赛 · 1–4 胜者组、5–6 败者组</div></div><button class="x" id="rs-qualifyX" aria-label="关闭">×</button></div>
    <div class="q-legend"><span class="wb"><i></i>胜者组 1–4</span><span class="lb"><i></i>败者组 5–6</span><span class="out"><i></i>淘汰 7–10</span></div>
    <div class="q-table" id="rs-qTable"></div>
  </div></div>

  <div class="modal" id="rs-attrModal"><div class="sheet">
    <div class="sh"><div class="crest" id="rs-attrCrest"></div><div><div class="id" id="rs-attrId"></div><div class="role" id="rs-attrRole"></div></div><button class="x" id="rs-attrX" aria-label="关闭">×</button></div>
    <div class="radarbox" id="rs-radarBox"></div>
    <div class="bars" id="rs-statBars"></div>
    <div class="moneyrow"><span class="k">资金</span><span class="mv mono" id="rs-moneyVal"></span></div>
    <div class="note">常规赛随机浮动由系统自动结算（不弹掷骰）。<b>稳定性</b>越高，临场浮动越小、越不容易失常。本场赛果由个人六维 + 临场发挥 + 队友实力共同决定。</div>
  </div></div>

  <div class="toast" id="rs-toast"></div>
</div>`;
}

function runRegularSeasonScreen(kind) {
  return new Promise((resolve) => {
    const host = (typeof document !== 'undefined' && document.body) ? document.body : null;
    // 无 DOM（极端环境）：退化为无头结算，保证引擎口径不变。
    const opps0 = E.shuffle([...(gameTeams ? gameTeams.domestic : ["InStar"])]).slice(0, 9);
    if (!host) { resolveHeadless(); return; }

    const opps = opps0;
    const rq = (id) => document.getElementById('rs-' + id);
    const raf = (cb) => (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(cb) : setTimeout(cb, 0);

    // ---- 状态 ----
    let idx = 0, wins = 0, gdSum = 0, phase = 'ready', busy = false, ended = false;
    const results = [];               // results[i] = {oppName, win, score, gd}
    let standings = null, rank = 0, inPlayoff = false;

    // ---- 队伍元信息（真实数据 + 复用 KO 调色/缩写） ----
    const npcMeta = (i) => ({ mono: koMono(opps[i]), color: teamColor(opps[i]) });

    // ---- 挂载 overlay ----
    const holder = document.createElement('div');
    holder.innerHTML = rsOverlayHTML(kind);
    host.appendChild(holder.firstElementChild);

    // 顶栏身份 + 玩家队卡
    rq('idTeam').textContent = P.teamName;
    rq('idRole').textContent = `${P.role} · 第 ${curYear} 赛年`;
    const meCrest = rq('vMe').querySelector('.crest');
    meCrest.style.setProperty('--tc', KO_HUNTER); meCrest.textContent = koMono(P.teamName);
    rq('vMe').querySelector('.nm').textContent = P.teamName;

    // ---- 比分合成：由真实 F/对手分差派生 BO3 小分（净胜：2:0→+2 / 2:1→+1 / 1:2→-1 / 0:2→-2） ----
    function synth(r) {
      const m = r.team - r.opp;
      if (r.win) { return m >= 8 ? { score: '2 : 0', gd: 2 } : { score: '2 : 1', gd: 1 }; }
      return m <= -8 ? { score: '0 : 2', gd: -2 } : { score: '1 : 2', gd: -1 };
    }

    // ---- 渲染 ----
    function fillVersus(i, resolved) {
      const r = results[i] || {}, op = rq('vOp'), m = npcMeta(i);
      rq('mcRd').textContent = '第 ' + (i + 1) + ' 轮';
      rq('mcCode').textContent = 'R' + (i + 1);
      op.querySelector('.crest').style.setProperty('--tc', m.color);
      op.querySelector('.crest').textContent = m.mono;
      op.querySelector('.nm').textContent = opps[i];
      op.className = 'vteam';
      rq('vMe').className = 'vteam player';
      rq('vScore').textContent = ''; rq('vsWord').style.display = '';
      if (resolved && r.score) {
        rq('vScore').textContent = r.score;
        rq('vsWord').style.display = 'none';
        rq('vMe').className = 'vteam player ' + (r.win ? 'win' : 'lose');
        op.className = 'vteam ' + (r.win ? 'lose' : 'win');
        rq('mStatus').textContent = r.win ? '本轮取胜' : '本轮失利';
      } else {
        rq('mStatus').textContent = '点击「开始本轮」结算这场 BO3 · 也可先在背包里使用加成道具';
      }
    }
    function updateProg() {
      const played = results.filter(Boolean).length, losses = played - wins;
      rq('recText').textContent = wins + ' - ' + losses;
      rq('progText').textContent = 'MATCH ' + played + ' / 9';
      rq('progBar').style.width = (played / 9 * 100) + '%';
    }
    function renderActBtn() {
      const btn = rq('actBtn'), cb = rq('continueBtn'), skip = rq('skipBtn');
      btn.className = 'bigbtn'; btn.disabled = false; cb.style.display = 'none';
      if (ended) {
        btn.classList.add('done'); btn.textContent = '查看详细晋级情况';
        skip.style.display = 'none'; rq('actHint').textContent = '';
        cb.className = 'bigbtn'; cb.style.display = ''; cb.textContent = inPlayoff ? '进入季后赛 →' : '继续训练 →';
        return;
      }
      // 一键跳过随时可点（demov4.0feedback·常规赛bug）：单步结算结束后必须重新启用，
      // 避免 setBtns(false) 之后第二场起按钮一直处于 disabled 状态。
      skip.style.display = ''; skip.disabled = false;
      btn.textContent = phase === 'ready' ? ('开始第 ' + (idx + 1) + ' 轮 →') : (idx >= 8 ? '结束常规赛 →' : '下一轮 →');
    }
    function renderBuffs() {
      const row = rq('buffRow'), chips = [];
      if (P.nextGameBuff > 0) chips.push('下场 F +' + P.nextGameBuff.toFixed(0));
      if (P.nextNoBadRoll) chips.push('本场不会失常');
      row.innerHTML = chips.length ? '<span class="lbl">本场加成：</span>' + chips.map(c => `<span class="buffchip">${c}</span>`).join('') : '';
    }
    function flashVs() { const mid = rq('vsMid'); if (!mid) return; mid.classList.remove('go'); void mid.offsetWidth; mid.classList.add('go'); }
    function renderStam() { const el = rq('stamPanel'); if (el) { el.innerHTML = staminaPanelHtml(E.gameCost('常规')); } }
    function renderMatchView() { fillVersus(idx, phase === 'result'); renderBuffs(); renderActBtn(); updateProg(); renderStam(); }
    function setBtns(on) { rq('actBtn').disabled = !on; rq('skipBtn').disabled = !on; }

    function pushReport(i) {
      const fe = rq('feedEmpty'); if (fe) fe.remove();
      const r = results[i], c = document.createElement('div');
      c.className = 'rcard ' + (r.win ? 'win' : 'lose');
      c.innerHTML = `<span class="rd mono">R${i + 1}</span>`
        + `<div class="match"><span class="tm me">${P.teamName}</span><span class="sc mono">${r.score}</span><span class="tm op">${r.oppName}</span></div>`
        + `<span class="res ${r.win ? 'w' : 'l'}">${r.win ? 'WIN' : 'LOSE'}</span>`;
      rq('feed').appendChild(c);
      raf(() => raf(() => { c.classList.add('in'); if (c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
    }

    // ---- 本屏弹窗（注入 playMatch 的赛中事件 / 名场面）----
    function rsChoose(title, body, choices) {
      return new Promise((res) => {
        rq('evtTtl').textContent = title.replace(/^赛中事件 · /, '');
        rq('evtRd').textContent = `第 ${idx + 1} 轮 · vs ${opps[idx]}`;
        rq('evtDesc').innerHTML = body;
        rq('evtOpts').innerHTML = choices.map((c, i) => `<button class="opt" data-i="${i}"><div class="ot">${c.label}</div></button>`).join('');
        rq('evtModal').classList.add('show');
        rq('evtOpts').querySelectorAll('.opt').forEach((b) => { b.onclick = () => { rq('evtModal').classList.remove('show'); res(+b.dataset.i); }; });
      });
    }
    function rsSay(title, body, cont) {
      return new Promise((res) => {
        rq('evtTtl').textContent = title;
        rq('evtRd').textContent = `第 ${idx + 1} 轮 · vs ${opps[idx]}`;
        rq('evtDesc').innerHTML = body;
        rq('evtOpts').innerHTML = `<button class="opt" data-i="0"><div class="ot">${cont || '继续'}</div></button>`;
        rq('evtModal').classList.add('show');
        rq('evtOpts').querySelector('.opt').onclick = () => { rq('evtModal').classList.remove('show'); res(0); };
      });
    }

    // ---- 一场对局：真实引擎结算 ----
    async function resolveOne() {
      const r = await playMatch("常规", E.OPP_POP["常规"], E.WIN_POP["常规"], { oppName: opps[idx], choose: rsChoose, say: rsSay });
      const s = synth(r);
      if (r.win) wins++;
      gdSum += s.gd;
      results[idx] = { oppName: opps[idx], win: r.win, score: s.score, gd: s.gd };
    }

    // ---- 单步 / 跳过 ----
    async function onAct() {
      if (busy) return;
      if (ended) { openQualify(); return; }
      if (phase === 'ready') {
        busy = true; setBtns(false);
        await resolveOne();
        phase = 'result';
        fillVersus(idx, true); pushReport(idx); flashVs(); updateProg(); renderStam();
        busy = false; renderActBtn();
      } else {
        idx++;
        if (idx >= 9) { endSeason(); return; }
        phase = 'ready'; renderMatchView();
      }
    }
    async function skipAll() {
      if (busy || ended) return;
      busy = true; setBtns(false);
      if (phase === 'result') idx++;
      while (idx < 9) {
        phase = 'ready';
        await resolveOne();
        pushReport(idx); updateProg();
        idx++;
      }
      busy = false;
      renderStam();   // demov4.1feedback2·一键跳过后体力显示为打完全部比赛后的值
      endSeason();
    }

    // ---- 赛季结束 ----
    function computeStandings() {
      const losses = 9 - wins;
      const rows = [{ name: P.teamName, mono: koMono(P.teamName), color: KO_HUNTER, player: true, w: wins, l: losses, gd: gdSum }];
      opps.forEach((nm, i) => {
        let w = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) w++;
        const l = 9 - w, gd = Math.round((w - l) * 1.4 + E.randint(-2, 2));
        rows.push({ name: nm, mono: koMono(nm), color: teamColor(nm), w, l, gd });
      });
      rows.sort((a, b) => b.w - a.w || b.gd - a.gd || (a.player ? -1 : b.player ? 1 : 0));
      standings = rows;
      rank = rows.findIndex(r => r.player) + 1;
      inPlayoff = rank <= 6;
    }
    function appendVerdict() {
      const v = document.createElement('div');
      v.className = 'verdict ' + (inPlayoff ? 'good' : 'bad');
      v.textContent = inPlayoff ? '恭喜晋级季后赛！' : '很遗憾止步常规赛';
      rq('feed').appendChild(v);
      raf(() => raf(() => { v.classList.add('in'); if (v.scrollIntoView) v.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
    }
    function endSeason() {
      if (ended) return; ended = true; phase = 'result';
      computeStandings();
      fillVersus(8, true); updateProg();
      appendVerdict(); renderActBtn();
    }

    // ---- 晋级情况弹窗 ----
    function openQualify() {
      if (!standings) computeStandings();
      let h = `<div class="q-hd"><span class="c">排名</span><span>战队</span><span class="c">胜</span><span class="c">负</span><span class="c">净胜</span></div>`;
      standings.forEach((r, i) => {
        const pos = i + 1, grp = pos <= 4 ? 'wb' : (pos <= 6 ? 'lb' : 'out'), gds = (r.gd > 0 ? '+' : '') + r.gd;
        h += `<div class="qrow ${grp}${r.player ? ' mine' : ''}${pos > 6 ? ' out' : ''}">`
          + `<span class="pos"><span class="grp"></span><span class="pn mono">${pos}</span></span>`
          + `<div class="team"><span class="crest" style="--tc:${r.color}">${r.mono}</span><span class="nm">${r.name}${r.player ? ' <span class="you">YOU</span>' : ''}</span></div>`
          + `<span class="c w mono">${r.w}</span><span class="c l mono">${r.l}</span><span class="c gd mono">${gds}</span></div>`;
        if (pos === 4) h += `<div class="q-cut">胜者组 1–4 / 败者组 5–6 分界</div>`;
        if (pos === 6) h += `<div class="q-cut">季后赛分割线 · TOP 6 晋级</div>`;
      });
      rq('qTable').innerHTML = h;
      rq('qualifyModal').classList.add('show');
    }

    // ---- 背包（真实 P.inv + useItem）----
    function rsIcon(name) {
      const m = INV_META[name] || {};
      if (m.slot === 'stam') return '<path d="M8 2h8l-1 6H9z"/><path d="M9 8c-1 4-1 8 0 12h6c1-4 1-8 0-12"/>';
      if (m.slot === 'heal') return '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>';
      if (m.noBadRoll) return '<path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4z"/>';
      if (m.slot === 'fbuff') return '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
      if (m.slot === 'redo') return '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
      if (m.slot === 'seal') return '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>';
      if (m.slot === 'serum') return '<path d="M9 3h6M10 3v6l-4 8a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-8V3"/>';
      return '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/>';
    }
    function bagTotal() { return Object.values(P.inv || {}).reduce((s, n) => s + (n > 0 ? n : 0), 0); }
    function updateBagBadge() { const t = bagTotal(); rq('bagBadge').textContent = t; rq('bagBadge').style.display = t ? 'grid' : 'none'; }
    function renderBag() {
      updateBagBadge();
      const usable = phase === 'ready' && !ended && !busy;
      rq('bagTip').textContent = usable ? '道具仅在本轮开打前可用' : '本场结算中 / 已结束，暂不可用道具';
      const items = Object.entries(P.inv || {}).filter(([, n]) => n > 0);
      rq('bagList').innerHTML = items.length ? items.map(([name, n]) => {
        const meta = INV_META[name] || {};
        return `<div class="item${usable ? '' : ' disabled'}">`
          + `<div class="iico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${rsIcon(name)}</svg></div>`
          + `<div class="ibody"><div class="inm">${name}</div><div class="idesc">${(meta.label || '').replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '')}</div></div>`
          + `<div class="icount mono">×${n}</div>`
          + `<button class="iuse" data-n="${name}" ${usable ? '' : 'disabled'}>使用</button></div>`;
      }).join('') : `<div class="bag-tip">背包空 · 可在赛季其它阶段的商店采购消耗品</div>`;
      rq('bagList').querySelectorAll('.iuse').forEach((b) => { b.onclick = () => { rsUseItem(b.dataset.n); }; });
    }
    function rsUseItem(name) {
      if (phase !== 'ready' || ended || busy) return;
      const before = (P.inv && P.inv[name]) || 0;
      useItem(name);                       // 真实生效（含全局 flash + renderHUD）
      const after = (P.inv && P.inv[name]) || 0;
      if (after < before) showToast(`已使用 ${name}`);
      // demov4.1feedback2·比赛界面：用药后体力 / 状态 tag（如清伤病移除腱鞘炎）立即在左侧面板刷新。
      renderBag(); renderBuffs(); renderStam();
    }

    // ---- 个人属性 ----
    function rsRadar(el, dims, size) {
      const R = size / 2 - 44, cx = size / 2, cy = size / 2 + 4, N = dims.length, NS = 'http://www.w3.org/2000/svg';
      const ang = (i) => (-90 + i * 360 / N) * Math.PI / 180, pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
      const poly = (vals) => vals.map((v, i) => pt(i, R * v / 100).join(',')).join(' ');
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', size); svg.setAttribute('height', size);
      let h = ''; [.25, .5, .75, 1].forEach((f) => { h += `<polygon points="${dims.map((d, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,.07)"/>`; });
      dims.forEach((d, i) => { const [x, y] = pt(i, R); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.06)"/>`; });
      h += `<polygon points="${poly(dims.map(d => d.v))}" fill="rgba(232,93,154,.18)" stroke="#e85d9a" stroke-width="2"/>`;
      dims.forEach((d, i) => {
        const [px, py] = pt(i, R * d.v / 100); h += `<circle cx="${px}" cy="${py}" r="3" fill="#e85d9a"/>`;
        const [lx, ly] = pt(i, R + 22); const anc = Math.abs(lx - cx) < 8 ? 'middle' : (lx > cx ? 'start' : 'end');
        h += `<text x="${lx}" y="${ly - 2}" fill="#eef2f8" font-size="12" font-family="Sora" font-weight="600" text-anchor="${anc}">${d.k}</text>`;
        h += `<text x="${lx}" y="${ly + 13}" fill="#f5cf6a" font-size="13" font-family="'Chakra Petch'" font-weight="700" text-anchor="${anc}">${d.label}</text>`;
      });
      svg.innerHTML = h; el.innerHTML = ''; el.appendChild(svg);
    }
    function openAttr() {
      const dims = [
        { k: '技术', v: Math.round(P.tech) }, { k: '战术', v: Math.round(P.tac) },
        { k: '体能', v: Math.round(P.phys) }, { k: '稳定性', v: Math.round(P.stab) },
        { k: '容貌', v: Math.round(P.appearance) }, { k: '人气', v: Math.round(P.pop), unit: '万' },
      ];
      rsRadar(rq('radarBox'), dims.map(d => ({ k: d.k, v: Math.min(100, d.v), label: d.v + (d.unit || '') })), 280);
      rq('statBars').innerHTML = dims.map(s => `<div class="stat"><span class="k">${s.k}</span><span class="track"><i style="width:${Math.min(100, s.v)}%"></i></span><span class="v mono">${s.v}${s.unit || ''}</span></div>`).join('');
      rq('moneyVal').textContent = Math.round(P.money).toLocaleString('en-US') + ' G';
      rq('attrCrest').textContent = koMono(P.teamName);
      rq('attrId').textContent = P.name;
      rq('attrRole').textContent = `${P.role} · 第 ${curYear} 赛年 · ${P.is_starter ? '首发' : '替补'}`;
      rq('attrModal').classList.add('show');
    }

    // ---- toast ----
    let toastTimer = null;
    function showToast(msg) { const t = rq('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

    // ---- 收尾 ----
    function teardown() { document.removeEventListener('keydown', onKey); const el = document.getElementById('rs-root'); if (el) el.remove(); }
    function onContinue() { const r = { rank, inPlayoff, wins }; teardown(); resolve(r); }
    function onKey(e) { if (e.key === 'Escape') { ['evtModal', 'bagModal', 'qualifyModal', 'attrModal'].forEach(id => rq(id) && rq(id).classList.remove('show')); } }

    // ---- 接线 ----
    rq('actBtn').addEventListener('click', onAct);
    rq('continueBtn').addEventListener('click', onContinue);
    rq('skipBtn').addEventListener('click', skipAll);
    rq('bagBtn').addEventListener('click', () => { renderBag(); rq('bagModal').classList.add('show'); });
    rq('bagX').addEventListener('click', () => rq('bagModal').classList.remove('show'));
    rq('bagModal').addEventListener('click', (e) => { if (e.target === rq('bagModal')) rq('bagModal').classList.remove('show'); });
    rq('attrBtn').addEventListener('click', openAttr);
    rq('attrX').addEventListener('click', () => rq('attrModal').classList.remove('show'));
    rq('attrModal').addEventListener('click', (e) => { if (e.target === rq('attrModal')) rq('attrModal').classList.remove('show'); });
    rq('qualifyX').addEventListener('click', () => rq('qualifyModal').classList.remove('show'));
    rq('qualifyModal').addEventListener('click', (e) => { if (e.target === rq('qualifyModal')) rq('qualifyModal').classList.remove('show'); });
    document.addEventListener('keydown', onKey);

    renderMatchView();
    updateBagBadge();

    // 无 DOM 时的无头退化：跑完真实结算并直接 resolve。
    async function resolveHeadless() {
      let w = 0, gd = 0;
      for (let g = 0; g < 9; g++) {
        const r = await playMatch("常规", E.OPP_POP["常规"], E.WIN_POP["常规"], { oppName: opps0[g] });
        if (r.win) w++;
        const m = r.team - r.opp; gd += r.win ? (m >= 8 ? 2 : 1) : (m <= -8 ? -2 : -1);
      }
      const others = []; for (let i = 0; i < 9; i++) { let x = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) x++; others.push(x); }
      const better = others.filter(x => x > w).length, ties = others.filter(x => x === w).length;
      const rk = 1 + better + E.randint(0, ties);
      resolve({ rank: rk, inPlayoff: rk <= 6, wins: w });
    }
  });
}

/* ---------------------- 季后赛 / 深渊淘汰赛「晋级图」UI ----------------- *
 * 双败 / 单败晋级图的渲染与流程统一由文件末尾的 KO 模块实现；玩家场由真实
 * playMatch 结算驱动，NPC 场为展示模拟，名次语义与历史切片保持一致。
 * --------------------------------------------------------------------- */

/* ---------------------- 冠军 / 名次结算 + FMVP ------------------------ */
function titleOf(kind) { return kind === "IVS" ? "IVS" : (kind === "深渊" ? "深渊（全球赛）" : kind + "季赛"); }

/* demov4.1feedback2·FMVP 界面：揭晓 FMVP 单列为独立弹窗，布局更具设计感。
 * 正文 = FMVP 词池随机 1 句 + 换行 + 固定结尾句（恭喜 {战队}_{ID} 荣获第{n}赛年{赛事}总决赛 FMVP！）。
 * 深渊 / 季后赛 / IVS 夺冠且获 FMVP 时，颁奖界面提供「FMVP」按钮点开此弹窗。 */
function ensureFmvpModal() {
  let m = document.getElementById("fmvpModal");
  if (m) { return m; }
  m = document.createElement("div");
  m.id = "fmvpModal"; m.className = "fmvp-modal";
  m.innerHTML = `<div class="fmvp-sheet">
    <button class="fmvp-x" id="fmvpX" aria-label="关闭">×</button>
    <div class="fmvp-rays"></div>
    <div class="fmvp-stage">
      <div class="fmvp-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4L12 2z"/></svg></div>
      <div class="fmvp-ey">FINALS MVP</div>
      <h2 class="fmvp-title">总决赛 FMVP</h2>
      <p class="fmvp-poem" id="fmvpPoem"></p>
      <p class="fmvp-credit" id="fmvpCredit"></p>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if (e.target === m) { m.classList.remove("show"); } });
  m.querySelector("#fmvpX").onclick = () => m.classList.remove("show");
  return m;
}
function openFmvpModal(speech) {
  const m = ensureFmvpModal();
  m.querySelector("#fmvpPoem").textContent = speech.poem;
  m.querySelector("#fmvpCredit").textContent = speech.credit;
  m.classList.add("show");
}
function closeFmvpModal() { const m = document.getElementById("fmvpModal"); if (m) { m.classList.remove("show"); } }

/* IVS / 国内冠军颁奖（demov4.1feedback2）：参考季后赛颁奖——一页颁奖 + 「FMVP」按钮点开弹窗。 */
async function settleChampion(kind, fList) {
  const fm = E.checkFMVP(P, curYear, fList);
  const money = E.placeMoney(kind, 1);
  E.settleChamp(P, kind, curYear, fm.won, money);
  const [popR] = E.CONFIG.CHAMP_REWARD[kind];
  const popGain = popR * P.pop_mult;
  pushLog(`${titleOf(kind)}夺冠${fm.won ? " + FMVP" : "（无 FMVP）"}！`, "good");
  const speech = fm.won ? E.fmvpSpeech(P, kind, curYear) : null;
  const why = fm.reason === "low" ? `你的场均 F ${fm.avg.toFixed(1)} 未达 90 门槛`
    : fm.reason === "mate" ? `你的场均 ${fm.avg.toFixed(1)} 未压过所有队友`
    : "";
  const fmvpNote = fm.won
    ? `<p class="champ-fmvp won">⭐ 本场 FMVP —— 是你！场均 F ${fm.avg.toFixed(1)} · 额外 人气 +${E.CONFIG.FMVP_REWARD[0]}、资金 +${E.CONFIG.FMVP_REWARD[1]} G</p>`
    : `<p class="champ-fmvp">本场 FMVP 属于你的队友 —— 冠军属于全队。${why ? `<span class="why">${why}。</span>` : ""}</p>`;
  while (true) {
    const c = await present({
      title: `${titleOf(kind)} · 颁奖`,
      sub: "AWARD CEREMONY",
      body: `
      <div class="champ-hero">
        <div class="champ-rays"></div>
        <div class="champ-trophy">🏆</div>
        <p class="champ-banner xl">${titleOf(kind)}冠军！</p>
        <p class="champ-reward">人气 <b>+${popGain.toFixed(1)} 万</b>　·　资金 <b>+${money} G</b></p>
        ${fmvpNote}
      </div>`,
      choices: fm.won
        ? [{ label: "FMVP", cls: "ghost" }, { label: "完成", cls: "primary" }]
        : [{ label: "完成", cls: "primary" }],
    });
    if (fm.won && c === 0) { openFmvpModal(speech); continue; }
    break;
  }
  closeFmvpModal();
}
async function settlePlacement(kind, place, fList) {
  if (place === 1) { await settleChampion(kind, fList); return; }
  const money = E.placeMoney(kind, place);
  if (place === 2) {
    E.settleRunnerup(P, kind, money); pushLog(`${titleOf(kind)}亚军。`, "");
    await say(`${titleOf(kind)} · 亚军`, `<p>决赛惜败，屈居亚军。人气 <b>+${(E.CONFIG.RUNNERUP_POP * P.pop_mult).toFixed(1)} 万</b>、资金 <b>+${money} G</b>。</p>
      <p class="muted">差一步登顶。亚军 + 季军累计够多、技战术够硬，也能走向「无冕之王」。</p>`, "继续");
  } else if (place === 3) {
    E.settleThird(P, kind, money); pushLog(`${titleOf(kind)}季军。`, "");
    await say(`${titleOf(kind)} · 季军`, `<p>季军赛你顶住了，拿下一枚铜牌。人气 <b>+${(E.CONFIG.THIRD_POP * P.pop_mult).toFixed(1)} 万</b>、资金 <b>+${money} G</b>。</p>`, "继续");
  } else {
    E.settlePlace(P, kind, place); pushLog(`${titleOf(kind)}止步第 ${place} 名。`, "");
    await say(`${titleOf(kind)} · 第 ${place} 名`, `<p>本届${titleOf(kind)}止步第 <b>${place}</b> 名。名次资金 <b>+${money} G</b>，胜场涨粉已计入。</p>`, "继续");
  }
}

/* v4.0：完整战报 / 全队排名（《demov3.0feedback·前三名界面·完整战报》）。
 * 列出所有名次，玩家所在名次高亮；其余席位用本局随机 NPC 队名填充。 */
function standingsHtml(title, slots, playerPlace, pool) {
  const others = E.shuffle((pool || []).filter((t) => t !== P.teamName));
  let oi = 0; const rows = [];
  for (let r = 1; r <= slots; r++) {
    const me = (r === playerPlace);
    const name = me ? P.teamName : (others[oi++] || `Team${r}`);
    const medal = r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r;
    rows.push(`<div class="stand-row ${me ? "me" : ""} ${r <= 3 ? "podium" : ""}"><span class="st-rank">${medal}</span><span class="st-name">${name}${me ? "（你）" : ""}</span></div>`);
  }
  return `<div class="standings"><div class="st-title">${title}</div>${rows.join("")}</div>`;
}
function abyssPool() {
  if (!gameTeams) return ["InStar"];
  return [...gameTeams.cn, ...gameTeams.jp, ...gameTeams.na, ...gameTeams.sea, ...gameTeams.hktw, ...gameTeams.kr, gameTeams.fixed];
}

// 夏/秋季赛：常规赛 → 双败季后赛。返回季后名次(无缘=8)
async function playDomestic(kind) {
  await competitionInjury(`${kind}季赛`);
  const { rank, inPlayoff } = await regularSeason(kind);
  if (!inPlayoff) { E.endCompetition(P); return 8; }
  P.playoff_count += 1;
  // v4.1（demov4.1feedback）：删除「进入季后赛」过场页——晋级直接进季后赛晋级图，未晋级直接回训练。
  // 双败季后赛为「晋级图」UI（移植 demo10-季后赛ui），赛果仍由真实 playMatch 驱动。
  setStage(`${kind}季赛·双败季后赛`);
  const spec = buildSeasonSpec(kind, rank);
  // v4.1：整屏「晋级图」UI 复刻 demo10-季后赛ui；玩家场走真实引擎结算，弹窗内含战报 + 颁奖。
  const { place } = await runKnockoutScreen(spec);
  E.endCompetition(P);
  return place;
}

// 通用淘汰/循环小赛段：返回 {wins, fList, lastReason}
async function playSeries(stage, n, oppPopBase, winPop, knockout, label, oppPool) {
  setStage(label);
  P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
  renderHUD();                 // 进入比赛周期即时刷新体力（demov2.1feedback2）
  let wins = 0; const fList = []; const lines = []; let lastReason = null;
  for (let g = 1; g <= n; g++) {
    const oppName = oppPool && oppPool.length ? E.choiceOf(oppPool) : "";
    const r = await playMatch(stage, oppPopBase, winPop, { oppName });
    fList.push(r.F); if (r.win) wins++; if (r.reason) lastReason = r.reason;
    lines.push(`<div class="gline ${r.win ? "w" : "l"}" style="animation-delay:${(g - 1) * 0.13}s">第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
    if (knockout && !r.win) break;
  }
  return { wins, fList, lines, lastReason };
}

async function playIVS() {
  await competitionInjury("IVS");
  await say("洲际邀请赛 IVS", `<p>你随队代表赛区出征 IVS！这里云集跨赛区精英，对手强度陡增（[70,84]）。</p>`, "出征");
  const { wins, fList, lines, lastReason } = await playSeries("IVS", 3, E.OPP_POP["IVS"], E.WIN_POP["IVS"], true, "洲际邀请赛 IVS");
  await say("IVS · 战报", `<div class="gamelog">${lines.join("")}</div>${reasonHtml(lastReason)}<p class="summary">${wins} 胜（3 连胜夺冠，2 胜止步亚军）。</p>`, wins === 3 ? "颁奖 →" : "继续");
  P.recent_perf = wins / 3.0;
  await settlePlacement("IVS", wins === 3 ? 1 : (wins === 2 ? 2 : 4), fList);
  E.endCompetition(P);
}

/* v4.0 深渊赛程重做（《demov3.0feedback·深渊》）：
 *   · 小组赛：每组 5 队循环（玩家打 4 场），取小组前 3 进淘汰赛；
 *   · 「总决赛阶段」更名「淘汰赛阶段」；小组第 1 直接 8 强、第 2/3 打 12 进 8；
 *   · 淘汰赛：8 强 → 半决 → 决赛，半决败者打季军赛；
 *   · 名次资金按 ABYSS_MONEY（冠 6000 / 亚 2000 / 季 1240 / 4th 1000 / 5-8 600 / 9-12 400 / 13-16 240）。*/
async function playAbyss(seeded) {
  await competitionInjury("深渊");
  // 庄园密信：进深渊前减免所有冠军疲劳——当年累积的全部金满贯同步疲劳一次性清零。
  if (P.has_seal && P._abyss_fatigue > 0) {
    const before = P._abyss_fatigue;
    P._abyss_fatigue = 0; P.has_seal = false; P.used_seal = true;   // v4.0 庄园快信追踪
    renderHUD();
    pushLog(`庄园密信生效：减免所有冠军疲劳（同步疲劳 −${before.toFixed(0)} → 0）。`, "good");
    await say("庄园密信 · 特赦令", `
      <p class="flavor">横扫赛季的疲惫，由这封密信替你全数扛下。深渊里，你还是满状态的那个你。</p>
      <p>减免所有冠军疲劳：深渊每场 F 回补 <b>+${before.toFixed(0)}</b>，本年深渊已无任何同步疲劳。</p>`, "继续");
  }
  await say("深渊的呼唤 · 全球赛", `
    <p class="flavor">深渊的呼唤——全球最高规格的舞台。能站在这里的，没有一个是弱者。</p>
    <p>${seeded ? "凭借国内季后赛的出色表现，你被<b>保送小组赛</b>，跳过预选！" : "你需要先从预选赛打起（2 场，胜 ≥1 进小组）。"}</p>
    <p class="muted">赛制：小组赛每组 5 队循环（你打 4 场），<b>小组前 3 进淘汰赛</b>；小组第 1 直接 8 强，第 2/3 需打 12 进 8。淘汰赛 8 强 → 半决 → 决赛（半决败者打季军赛）。</p>
    ${P._abyss_fatigue > 0 ? `<p class="muted">⚠ 同年同步疲劳：本年深渊前已夺 ${(P._abyss_fatigue / E.CONFIG.ABYSS_SYNC_FATIGUE_PER).toFixed(0)} 冠，深渊每场 F −${P._abyss_fatigue.toFixed(0)}（每多 1 冠 −2，封顶 −6）。</p>` : ""}`, "进入深渊");

  const pool = abyssPool();
  if (!seeded) {
    const pre = await playSeries("预选", 2, E.OPP_POP["深渊"], E.WIN_POP["预选"], false, "深渊·预选赛", pool);
    await say("深渊 · 预选赛战报", `<div class="gamelog stream">${pre.lines.join("")}</div>${reasonHtml(pre.lastReason)}<p class="summary">预选 ${pre.wins} 胜（需 ≥1 进小组）。</p>`, "继续");
    if (pre.wins < 1) {
      pushLog("深渊预选出局。", "bad"); P.recent_perf = 0.1;
      // demov4.1feedback2·深渊战报：没进淘汰赛——简化为本队深渊排名 + 查看完整排名弹窗 / 继续。
      await abyssEliminatedScreen("止步预选赛 · 未进小组", 16);
      E.endCompetition(P); return;
    }
  }

  // 小组赛：5 队循环，玩家打 4 场，取前 3 进淘汰赛。
  const grp = await playSeries("小组", 4, E.OPP_POP["深渊"], E.WIN_POP["小组"], false, "深渊·小组赛", pool);
  // 由玩家胜场推算小组排名（其余 4 队胜场随机模拟）。
  const otherWins = []; for (let i = 0; i < 4; i++) { let w = 0; for (let k = 0; k < 4; k++) if (Math.random() < 0.5) w++; otherWins.push(w); }
  const better = otherWins.filter(w => w > grp.wins).length;
  const ties = otherWins.filter(w => w === grp.wins).length;
  const groupRank = Math.min(5, 1 + better + E.randint(0, ties));
  if (groupRank > 3) {
    // demov4.1feedback2·深渊战报：没进淘汰赛——不再罗列逐场战报，简化为本队深渊排名 + 查看完整排名弹窗 / 继续。
    pushLog("深渊小组赛出局（第 " + groupRank + " 名）。", "bad"); P.recent_perf = grp.wins / 4.0;
    E.settlePlace(P, "深渊", 13);   // 名次资金（与原结算等额，静默处理）
    await abyssEliminatedScreen(`第 13–16 名（小组第 ${groupRank}）`, 13);
    E.endCompetition(P); return;
  }
  await say("深渊 · 小组赛战报", `<div class="gamelog stream">${grp.lines.join("")}</div>${reasonHtml(grp.lastReason)}
    <p class="summary">小组赛 <b>${grp.wins} 胜 ${4 - grp.wins} 负</b>，小组 <b>第 ${groupRank} 名</b>（前 3 进淘汰赛）。</p>
    <p class="ok">${groupRank === 1 ? "🎉 小组头名！直接晋级 8 强，免打 12 进 8。" : "🎉 小组前 3 出线，需打一场 12 进 8。"}</p>`,
    "进入淘汰赛");

  // v4.1：深渊淘汰赛改为「晋级图」UI（移植 demo10-深渊ui）。小组第 1 直进 8 强、第 2/3 先打
  // 12 进 8；晋级图由真实 playMatch 结算驱动，NPC 场为展示模拟，名次语义与历史一致。
  setStage("深渊·淘汰赛");
  const koSpec = buildAbyssSpec(groupRank);
  // v4.1：整屏「晋级图」UI 复刻 demo10-深渊ui；玩家场走真实引擎结算，弹窗内含战报 + 颁奖。
  await runKnockoutScreen(koSpec);
  E.endCompetition(P);
}
/* demov4.1feedback2·深渊战报：完整排名弹窗（所有队伍深渊排名，复用 standingsHtml 的 16 强排版）。 */
function ensureRankModal() {
  let m = document.getElementById("rankModal");
  if (m) { return m; }
  m = document.createElement("div");
  m.id = "rankModal"; m.className = "bagx-modal rank-modal";
  m.innerHTML = `<div class="bagx-sheet rank-sheet">
    <div class="bagx-head"><div><div class="ttl">深渊全球赛 · 最终排名</div><div class="sub">GLOBAL FINALS · 16 强</div></div><button class="bagx-x" id="rankX" aria-label="关闭">×</button></div>
    <div class="rank-body" id="rankBody"></div></div>`;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if (e.target === m) { m.classList.remove("show"); } });
  m.querySelector("#rankX").onclick = () => m.classList.remove("show");
  return m;
}
function openRankModal(html) {
  const m = ensureRankModal();
  m.querySelector("#rankBody").innerHTML = html;
  m.classList.add("show");
}
function closeRankModal() { const m = document.getElementById("rankModal"); if (m) { m.classList.remove("show"); } }
// 没进淘汰赛时的深渊战报：本队深渊排名 + 「查看完整排名」弹窗 + 「继续」。
async function abyssEliminatedScreen(rankText, placedRank) {
  const pool = abyssPool();
  while (true) {
    const c = await present({
      title: "深渊的呼唤 · 战报",
      sub: "GLOBAL FINALS",
      body: `<div class="abyss-out"><div class="ao-lab">本队深渊排名</div><div class="ao-rank">${rankText}</div></div>`,
      choices: [{ label: "查看完整排名", cls: "ghost" }, { label: "继续", cls: "primary" }],
    });
    if (c === 0) { openRankModal(standingsHtml("", 16, placedRank, pool)); continue; }
    break;
  }
  closeRankModal();
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
/* v4.0 转会选队（《demov3.0feedback·转会》）：不再手动输入队名，而是从本局随机生成的
 * 9 支大陆战队（含固定 NPC InStar，排除当前所属）中随机刷新若干支「要你」的队伍，
 * 属性越高、近期战绩越好，愿意要你的队伍越多；玩家从中选择，原队伍随即成为 NPC 回填队名池。 */
async function selectNewTeam(label) {
  const oldTeam = P.teamName;
  const pool = (gameTeams && gameTeams.domestic ? gameTeams.domestic : ["InStar"]).filter((t) => t !== oldTeam);
  if (!pool.length) { pushLog(`${label}：暂无下家，留队。`, ""); return; }
  const n = Math.max(1, Math.min(pool.length, 2 + Math.round(P.cp / 90) + (P.recent_perf >= 0.5 ? 1 : 0)));
  const cands = E.shuffle([...pool]).slice(0, n);
  const idx = await choose(`转会窗口 · ${label} · 选择新东家`,
    `<p class="flavor">经纪人摊开一沓报价单：「这些队都想要你。挑一个吧——从今天起，你穿上他们的队服。」</p>
     <p class="muted">共 <b>${cands.length}</b> 支战队抛来邀约（属性越高、战绩越好，愿意要你的队伍越多）；选定后，你原来的「${oldTeam}」将成为联盟里的一支 NPC 战队。</p>`,
    cands.map((t) => ({ label: t, hint: `加盟 ${t}_${P.playerId}` })));
  const chosen = cands[idx];
  if (gameTeams && gameTeams.domestic) {
    gameTeams.domestic = gameTeams.domestic.filter((t) => t !== chosen);
    if (!gameTeams.domestic.includes(oldTeam)) gameTeams.domestic.push(oldTeam);
    gameTeams.cn = (gameTeams.cn || []).filter((t) => t !== chosen);
    if (oldTeam !== "InStar" && !gameTeams.cn.includes(oldTeam)) gameTeams.cn.push(oldTeam);
  }
  const oldFull = P.name;
  P.renameTeam(chosen); renderHUD();
  pushLog(`转会加盟：${oldFull} → ${P.name}`, "");
}

async function transferWindow(label) {
  setStage(`${label}·转会窗口`);
  const forced = E.transferRollForced(P);
  let moved = false;
  if (forced === "sell") {
    E.doTransfer(P); moved = true;
    pushLog(`${label}：被发卖，加入新战队。`, "");
    await say(`转会窗口 · ${label}`, `<p class="flavor">经理把你叫进办公室，话说得委婉，意思却清楚：俱乐部已经替你联系好了下家。这一次，你没有选择权。</p>`, "接受");
    await selectNewTeam(label);
  } else if (forced === "offer") {
    const idx = await choose(`转会窗口 · ${label}`,
      `<p class="flavor">有别的战队抛来橄榄枝，条件开得很诱人。教练和经理把决定权交回你手上——是留下，还是走？</p>`,
      [{ label: "留队", hint: "珍惜现有默契，冲击「一人一城」" }, { label: "接受转会", hint: "换个环境，队友基准随机变化" }]);
    if (idx === 1) {
      E.doTransfer(P); moved = true;
      pushLog(`${label}：主动转会。`, "");
      await selectNewTeam(label);
    }
  }
  const amb = E.transferAmbient(P);
  let rosterChanged = amb.length > 0;
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
  // v4.0 位置变更事件（《demov3.0feedback·突发事件·位置变更》）：转会期后若本队有人员变更，
  // 5% 概率触发，每个转会窗口最多一次。可能要求转位置（万能螺丝成就）甚至被劝退退役。
  if (rosterChanged && Math.random() < 0.05) {
    await positionChangeEvent(label);
  }
}

/* 位置变更事件：两种文案随机——位置重合（要求转位置，拒绝则 70% 转会 / 30% 退役）、
 * 位置空缺（要求补位，拒绝仅稳定 −2）。转位置：求生者↔监管者，并记 changed_position（万能螺丝）。 */
async function positionChangeEvent(label) {
  const switchRole = () => {
    P.role = (P.role === "监管者") ? "求生者" : "监管者";
    P.changed_position = true;
    pushLog(`位置变更：转为${P.role}。`, "");
  };
  if (Math.random() < 0.5) {
    // 位置重合
    const idx = await choose(`突发事件 · 位置变更`,
      `<p class="flavor">俱乐部签了一位新人，她/他和你的位置有冲突。经理和教练找到你，希望你能够转位置，不然将被劝退——你选择：</p>`,
      [{ label: "我是战队一块砖，哪里需要往哪搬", hint: "转位置（求生者↔监管者）" },
       { label: "此处不留爷，自有留爷处", hint: "拒绝：70% 转会 / 30% 退役" }]);
    if (idx === 0) {
      switchRole();
      await say(`位置变更 · ${label}`, `<p>你接下了新角色。教练拍拍你肩膀：「难为你了。」<br>当前定位：<b>${P.role}</b>。</p>`, "继续");
    } else {
      if (Math.random() < 0.7) {
        E.doTransfer(P);
        pushLog(`位置冲突：拒绝转位置，转会离队。`, "");
        await say(`位置变更 · ${label}`, `<p class="flavor">你头也不回地收拾好外设。很快，新的报价单递到了你手上。</p>`, "选择新东家");
        await selectNewTeam(label);
      } else {
        pushLog(`位置冲突：无人接收，退役。`, "bad");
        await say(`位置变更 · ${label}`, `<p class="flavor">你赌上了尊严，却没等来下家。转会窗口关闭的那一刻，你的职业生涯也按下了停止键。</p>`, "接受结局");
        throw { forced: "黯然退役" };
      }
    }
  } else {
    // 位置空缺
    const idx = await choose(`突发事件 · 位置变更`,
      `<p class="flavor">队伍出现了较大的人员空缺，经理和教练找到你，希望你能够补位。</p>`,
      [{ label: "我是战队一块砖，哪里需要往哪搬", hint: "转位置（求生者↔监管者）" },
       { label: "动之以情，晓之以理，坚持自己的位置", hint: "稳定 −2" }]);
    if (idx === 0) {
      switchRole();
      await say(`位置变更 · ${label}`, `<p>你顶上了空缺。当前定位：<b>${P.role}</b>。</p>`, "继续");
    } else {
      P.stab = Math.max(0, P.stab - 2); renderHUD();
      await say(`位置变更 · ${label}`, `<p>你说服了管理层，留在熟悉的位置。但这场拉扯让你有些分心。稳定 <b>−2</b>。</p>`, "继续");
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

      setYearPhase(0);
      const n1 = (P.identity === "青训" && curYear === 1) ? 7 : (P.rest_active ? E.CONFIG.REST_TRAIN_N : 5);
      await trainingPeriod(n1, "训练① · 季前");

      setYearPhase(1);
      if (await selection("夏季赛")) { const b = P.champ["夏"]; summerRank = await playDomestic("夏"); if (P.champ["夏"] > b) yc.add("夏"); }
      await transferWindow("夏季赛后");

      setYearPhase(2);
      if (summerRank <= 2 && P.is_starter) { const b = P.champ["IVS"]; await playIVS(); if (P.champ["IVS"] > b) yc.add("IVS"); }

      setYearPhase(3);
      await trainingPeriod(P.rest_active ? E.CONFIG.REST_TRAIN_N : 5, "训练② · 夏秋之间");

      setYearPhase(4);
      if (await selection("秋季赛")) { const b = P.champ["秋"]; autumnRank = await playDomestic("秋"); if (P.champ["秋"] > b) yc.add("秋"); }

      setYearPhase(5);
      await trainingPeriod(P.rest_active ? E.CONFIG.REST_TRAIN_N : 5, "训练③ · 深渊前");

      setYearPhase(6);
      if (await selection("深渊")) {
        const seeded = (summerRank + autumnRank) / 2.0 <= 2.0;
        // v6.0：每多 1 冠 −2/场，整场封顶 −6。
        P._abyss_fatigue = Math.min(E.CONFIG.ABYSS_SYNC_FATIGUE_CAP, E.CONFIG.ABYSS_SYNC_FATIGUE_PER * yc.size);
        const b = P.champ["深渊"]; await playAbyss(seeded); P._abyss_fatigue = 0;
        if (P.champ["深渊"] > b) yc.add("深渊");
      }

      if (["夏", "秋", "IVS", "深渊"].every(k => yc.has(k))) grandSlam = true;

      setYearPhase(7);
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
  // demov4.1feedback·结算界面：结算页隐藏左侧边栏，战报卡占满主区。
  if (typeof document !== "undefined" && document.body) { document.body.classList.add("settle-mode"); }
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
    fullCareer, year: curYear, tech: P.tech, tac: P.tac, phys: P.phys, stab: P.stab,
    appearance: P.appearance, luck: P.luck, pop: P.pop, money: P.money,
    champ: { ...P.champ }, runnerups: P.runnerups, thirds: P.thirds, fmvp_total: P.fmvp_total,
    playoff_count: P.playoff_count, transfer_count: P.transfer_count, rest_year_count: P.rest_year_count,
    spotlights: [...P.spotlight], achs: got, date: new Date().toLocaleDateString("zh-CN"),
  };
  // 持久化（v3.0）：localStorage 存当前周目战报 + 累计成就/结局图鉴（历史解锁）。
  const codex = persistRun(rec);

  // v4.0：本周目解锁的成就逐条弹出（右下角，按分级配色，5s 自动关闭）。
  // demov4.1feedback：里程碑成就已在达成瞬间弹过，结局阶段只补弹剩余（如金满贯/满役类终局成就），避免重复。
  const popped = P._poppedAchs || new Set();
  const toPop = got.filter(name => !popped.has(name));
  toPop.forEach((name, i) => setTimeout(() => achToast(name), 600 + i * 700));

  // 结局界面循环：再来一局退出；其余按钮看完返回本页。feedback14：成就仅列名称。
  while (true) {
    setStage("生涯落幕");
    const choice = await present({
      title: "生涯战报",
      sub: "CAREER REPORT",
      // demov4.1feedback2·结局界面：删除卡片外重复的「截图保存」句（战报卡页脚已保留一句）。
      body: warCardHtml(rec, isForced),
      // demov4.1feedback2·结局界面：三个按钮文字居中、去除 emoji。
      choices: [
        { label: "全部结局与成就", cls: "ghost" },
        { label: "复制战报文案", cls: "ghost" },
        { label: "再来一局", cls: "primary" },
      ],
    });
    if (choice === 0) { await codexPanel(rec, codex); continue; }
    if (choice === 1) { await copyWarCard(rec); continue; }
    break;
  }
  if (typeof document !== "undefined" && document.body) { document.body.classList.remove("settle-mode"); }
  logLines = []; P = null; renderHUD();
  // 重开由顶层 gameLoop() 循环驱动，ending() 直接返回，避免调用栈无限增长。
}

/* ----------------------- 生涯战报卡（v3.0 · 可截图分享） --------------------- */
const ENDING_TIER_CLASS = { "黄金": "e-gold", "白银": "e-silver", "青铜": "e-bronze", "普通": "e-normal" };
function endingTierClass(name) { return ENDING_TIER_CLASS[E.endingTier(name)] || "e-normal"; }
/* 生涯六维雷达（结算卡，参考 demo7-生涯战报卡A 单层多边形）：返回内联 SVG 字符串。
 * 运气不纳入六维——第六维改为「人气」（demov4.1feedback）。 */
function settleRadarSVG(dims, size) {
  const R = size / 2 - 46, cx = size / 2, cy = size / 2 + 6, N = dims.length;
  const ang = (i) => (-90 + i * 360 / N) * Math.PI / 180;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const poly = (vals) => vals.map((v, i) => pt(i, R * Math.min(100, v) / 100).join(",")).join(" ");
  let h = "";
  [.25, .5, .75, 1].forEach((f) => { h += `<polygon points="${dims.map((d, i) => pt(i, R * f).join(",")).join(" ")}" fill="none" stroke="rgba(255,255,255,.07)"/>`; });
  dims.forEach((d, i) => { const [x, y] = pt(i, R); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.06)"/>`; });
  h += `<polygon points="${poly(dims.map(d => d.v))}" fill="rgba(245,207,106,.18)" stroke="#f5cf6a" stroke-width="2"/>`;
  dims.forEach((d, i) => {
    const [px, py] = pt(i, R * Math.min(100, d.v) / 100); h += `<circle cx="${px}" cy="${py}" r="3.2" fill="#f5cf6a"/>`;
    const [lx, ly] = pt(i, R + 24); const anc = Math.abs(lx - cx) < 8 ? "middle" : (lx > cx ? "start" : "end");
    h += `<text x="${lx}" y="${ly - 4}" fill="#eef2f8" font-size="12.5" font-family="Sora" font-weight="600" text-anchor="${anc}">${d.k}</text>`;
    h += `<text x="${lx}" y="${ly + 11}" fill="#f5cf6a" font-size="14" font-family="Sora" font-weight="700" text-anchor="${anc}">${d.label}</text>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${h}</svg>`;
}
// 生涯结算战报卡（demov4.1feedback：严格参考 demo7-生涯战报卡A 排版；运气→人气六维 + 资金条）。
function warCardHtml(rec, isForced) {
  const endingText = (E.ENDING_TEXT[rec.final] || "").replace("玩家ID", rec.playerId);
  const tier = E.endingTier(rec.final);
  const dims = [
    { k: "技术", v: Math.round(rec.tech), label: Math.round(rec.tech) },
    { k: "战术", v: Math.round(rec.tac), label: Math.round(rec.tac) },
    { k: "体能", v: Math.round(rec.phys), label: Math.round(rec.phys) },
    { k: "稳定性", v: Math.round(rec.stab), label: Math.round(rec.stab) },
    { k: "容貌", v: Math.round(rec.appearance), label: Math.round(rec.appearance) },
    { k: "人气", v: Math.round(rec.pop), label: Math.round(rec.pop) + "万" },
  ];
  const totalChamp = rec.champ["夏"] + rec.champ["秋"] + rec.champ["IVS"] + rec.champ["深渊"];
  const champCells = [["夏季赛", rec.champ["夏"]], ["秋季赛", rec.champ["秋"]], ["洲际赛 IVS", rec.champ["IVS"]], ["深渊赛", rec.champ["深渊"]]]
    .map(([k, n]) => `<div class="honor ${n > 0 ? "hi" : "mute"}"><div class="n">${n}</div><div class="k">${k}</div></div>`).join("");
  const otherCells = [["亚军", rec.runnerups], ["季军", rec.thirds], ["FMVP", rec.fmvp_total], ["名场面", rec.spotlights.length]]
    .map(([k, n]) => `<div class="honor ${n > 0 ? "hi" : ""}"><div class="n">${n}</div><div class="k">${k}</div></div>`).join("");
  const allA = Object.keys(E.ACH_DESC).length;
  const chips = rec.achs.length
    ? rec.achs.map(a => `<span class="chip on ${ACH_TIER_CLASS[E.achTier(a)] || "t-bronze"}">${a}<span class="d">${E.achTier(a)}</span></span>`).join("")
    : `<span class="chip">本周目未解锁成就</span>`;
  return `
    <div class="scard ${isForced ? "bad" : "good"}" id="warcard">
      <div class="sc-card ${endingTierClass(rec.final)}">
        <div class="sc-ch">
          <div class="sc-crest">${koMono(rec.teamName)}</div>
          <div class="sc-who">
            <div class="sc-id">${rec.name}</div>
            <div class="sc-meta">
              <span class="tag title">${rec.idShort} · ${rec.role}</span>
            </div>
          </div>
          <a class="sc-qr" href="https://erinlyv.github.io/IVL_Game" target="_blank" rel="noopener" aria-label="扫码体验 IVL_Game">
            <img src="qr-ivlgame.png" alt="IVL_Game 二维码" width="64" height="64" />
          </a>
        </div>
        <div class="sc-hr"></div>
        <div class="sc-ending">
          <div class="lab">FINAL ENDING · 最终结局</div>
          <div class="sc-ename ${endingTierClass(rec.final)}" data-tier="${tier}">${rec.final}</div>
          <div class="sc-etier ${endingTierClass(rec.final)}">${tier}结局</div>
          <div class="sc-quote">${endingText}</div>
        </div>
        <div class="sc-hr"></div>
        <div class="sc-radar">
          <div class="sc-sechead"><span class="bar"></span><h3>生涯六维</h3></div>
          <div class="sc-radarbox">${settleRadarSVG(dims, 320)}</div>
        </div>
        <div class="sc-stats2">
          <div class="sc-stat money">
            <div class="lab">资金</div>
            <div class="v">${Math.round(rec.money).toLocaleString("en-US")} <em>G</em></div>
            <div class="note">退役结余资金</div>
          </div>
          <div class="sc-stat luck">
            <div class="lab">运气</div>
            <div class="v">${Math.round(rec.luck)} <em>LUCK</em></div>
            <div class="note">生涯落幕揭晓</div>
          </div>
        </div>
        <div class="sc-honors">
          <div class="hslabel"><span class="bar"></span>冠军 · 按赛事（共 ${totalChamp} 冠）</div>
          <div class="champgrid">${champCells}</div>
          <div class="hslabel"><span class="bar"></span>其他荣誉</div>
          <div class="honorgrid">${otherCells}</div>
        </div>
        <div class="sc-ach">
          <div class="sc-sechead between"><div class="left"><span class="bar"></span><h3>已达成就</h3></div><div class="prog">本档解锁 <b>${rec.achs.length}</b> / ${allA}</div></div>
          <div class="chips">${chips}</div>
        </div>
        <div class="sc-foot"><span class="tip">📸 截图保存这张战报卡，晒到同人圈吧！</span><span class="sc-date">${rec.date} · #IVL模拟器 demo-v4.1</span></div>
      </div>
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
  lines.push(`#IVL模拟器 demo-v4.0`);
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
/* 结局 / 成就图鉴（demov4.1feedback·结局与成就一览）：拆成「结局」「成就」两页，
 * 单元格按分级排序（白金→黄金→白银→青铜→普通），未解锁的隐藏成就排到最后。 */
const CX_TIER_ORDER = { "白金": 0, "黄金": 1, "白银": 2, "青铜": 3, "普通": 4 };
function codexEndingGrid(rec, codex) {
  const names = Object.keys(E.ENDING_TEXT).slice()
    .sort((a, b) => (CX_TIER_ORDER[E.endingTier(a)] ?? 9) - (CX_TIER_ORDER[E.endingTier(b)] ?? 9));
  const cells = names.map(name => {
    const here = rec && name === rec.final;
    const ever = (codex.endings || []).includes(name);
    const cls = here ? "cx-here" : (ever ? "cx-ever" : "cx-lock");
    const tag = here ? "本档" : (ever ? "已解锁" : "未解锁");
    const tier = E.endingTier(name);
    return `<div class="cx-cell ${cls} ${endingTierClass(name)}"><div class="cx-name">${name}<span class="cx-tier">${tier}</span></div>
      <div class="cx-desc">${(E.ENDING_TEXT[name] || "").replace("玩家ID", rec ? rec.playerId : "你")}</div>
      <div class="cx-tag">${tag}</div></div>`;
  }).join("");
  return `<div class="cx-grid">${cells}</div>`;
}
function codexAchGrid(rec, codex) {
  const isUnlocked = (n) => (rec && rec.achs.includes(n)) || (codex.achs || []).includes(n);
  const names = Object.keys(E.ACH_DESC).slice().sort((a, b) => {
    // 未解锁的隐藏成就统一沉到最后；其余按分级（白金→普通）排序。
    const ha = E.ACH_HIDDEN.has(a) && !isUnlocked(a), hb = E.ACH_HIDDEN.has(b) && !isUnlocked(b);
    if (ha !== hb) return ha ? 1 : -1;
    return (CX_TIER_ORDER[E.achTier(a)] ?? 9) - (CX_TIER_ORDER[E.achTier(b)] ?? 9);
  });
  const cells = names.map(name => {
    const here = rec && rec.achs.includes(name);
    const ever = (codex.achs || []).includes(name);
    const cls = here ? "cx-here" : (ever ? "cx-ever" : "cx-lock");
    const tag = here ? "本档" : (ever ? "已解锁" : "未解锁");
    const tier = E.achTier(name);
    const hidden = E.ACH_HIDDEN.has(name) && !here && !ever;
    const tcls = (ACH_TIER_CLASS[tier] || "t-bronze");
    return `<div class="cx-cell ${cls} ${tcls}"><div class="cx-name">${hidden ? "？？？" : name}${hidden ? "" : `<span class="cx-tier">${tier}</span>`}</div>
      <div class="cx-desc">${hidden ? "隐藏成就 —— 达成后揭晓。" : (E.ACH_DESC[name] || "")}</div>
      <div class="cx-tag">${tag}</div></div>`;
  }).join("");
  return `<div class="cx-grid">${cells}</div>`;
}
// 图鉴弹窗（独立 overlay，不占用 #main，避免打断进行中的训练/比赛流程）。
function ensureCodexModal() {
  let m = document.getElementById("codexModal");
  if (m) { return m; }
  m = document.createElement("div");
  m.id = "codexModal"; m.className = "cx-modal";
  m.innerHTML = `<div class="cx-sheet">
    <div class="cx-head">
      <div class="cx-tabs">
        <button class="cx-tab" data-tab="ending">结局图鉴</button>
        <button class="cx-tab" data-tab="ach">成就图鉴</button>
      </div>
      <button class="cx-x" id="cxX" aria-label="关闭">×</button>
    </div>
    <div class="cx-sub" id="cxSub"></div>
    <div class="cx-scroll" id="cxBody"></div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
function renderCodexModal(rec, codex, tab) {
  const m = ensureCodexModal();
  const allE = Object.keys(E.ENDING_TEXT).length, allA = Object.keys(E.ACH_DESC).length;
  const isE = tab === "ending";
  m.querySelectorAll(".cx-tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  m.querySelector("#cxSub").textContent = isE
    ? `结局 ${(codex.endings || []).length}/${allE}（含历史周目累计）· 排序：白金→普通`
    : `成就 ${(codex.achs || []).length}/${allA}（含历史周目累计）· 排序：白金→普通，未解锁隐藏成就置后`;
  m.querySelector("#cxBody").innerHTML = isE ? codexEndingGrid(rec, codex) : codexAchGrid(rec, codex);
  m.querySelectorAll(".cx-tab").forEach(b => { b.onclick = () => renderCodexModal(rec, codex, b.dataset.tab); });
}
function openCodexWith(rec, codex, startTab) {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || !document.body) { resolve(); return; }
    const m = ensureCodexModal();
    const close = () => { m.classList.remove("show"); m.removeEventListener("click", onBg); resolve(); };
    const onBg = (e) => { if (e.target === m) { close(); } };
    renderCodexModal(rec, codex, startTab || "ending");
    m.querySelector("#cxX").onclick = close;
    m.addEventListener("click", onBg);
    m.classList.add("show");
  });
}
// 结局界面「全部结局与成就」入口：带当前周目 rec 高亮「本档」。
async function codexPanel(rec, codex) { await openCodexWith(rec, codex, "ending"); }
// 启动菜单图鉴入口（无当前周目时只读历史存档）。
async function openCodex(startTab) {
  const codex = loadCodex();
  const rec = (codex.last && codex.last.v === 3) ? codex.last : null;
  await openCodexWith(rec, codex, startTab);
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
    title: "声明",
    body: `
      <p>欢迎来到《IVL 模拟器》。你将扮演一名第五人格职业电竞选手征战赛场。</p>
      ${progress}
      <p class="muted">本作品为第五人格赛事粉丝二创，为爱发电非盈利。本作品中涉及的角色行为、故事情节均为作者虚构或出于创作需要进行加工，不涉及对现实人物或事件的影射或指控，请勿对号入座，请勿贴脸。</p>
      <p class="muted">请大家多玩第五人格，多看第五人格赛事。</p>
      <p class="muted">若有任何不妥之处或任何疑问，请 xhs 私信作者：9530174979</p>
      <p class="declaim-em">比赛有输赢，人生没有。每一位为梦想奋斗的人都值得尊重。</p>`,
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
      // 让出事件循环：避免 boot() 在首个 await 前同步抛错时陷入 100% CPU 忙重启。
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

/* v4.0 启动页（demo9 电影首帧）：进入游戏前先展示标题画面，「开始生涯」后淡出并进入主循环；
 * 若本地有历史存档，则「结局与成就」可直接查看上局图鉴，再进入主循环。 */
let gameStarted = false;
function dismissSplash() {
  const sp = document.getElementById("splash");
  if (sp) { sp.classList.add("hide"); setTimeout(() => { sp.style.display = "none"; }, 650); }
}
async function startFromSplash() {
  if (gameStarted) return;
  gameStarted = true;
  dismissSplash();
  gameLoop();
}
window.addEventListener("DOMContentLoaded", () => {
  renderHUD();
  const startBtn = document.getElementById("splashStart");
  const cxBtn = document.getElementById("splashCodex");
  if (!startBtn) { gameLoop(); return; }   // 无启动页（如测试 DOM）时直接开始
  const codex = loadCodex();
  // demov4.1feedback·结局与成就一览：图鉴入口只在初始菜单提供（游戏中不再常驻）；
  // 直接在启动页之上弹出图鉴弹窗（内含结局/成就切换页），看完关闭仍回到启动页，不会提前开始游戏。
  const hasHistory = (codex.runs || 0) > 0 || !!codex.last;
  if (cxBtn && hasHistory) { cxBtn.hidden = false; cxBtn.onclick = () => openCodex("ending"); }
  startBtn.onclick = () => startFromSplash();
});

/* =============================================================================
 * 季后赛 / 深渊淘汰赛「晋级图」整屏 UI —— 完整复刻 UI设计/demo10-季后赛ui · demo10-深渊ui
 * --------------------------------------------------------------------------- *
 * 设计原则（《demov4.0feedback·完全复刻 demo10》）：画面 1:1 复刻设计稿（左栏赛况 +
 * 刀光对撞 + 掷骰 + 右栏晋级图 + 战报弹窗 + 颁奖弹窗），**只有战队名称与数值随真实进程变化**。
 *   · 玩家参与的对局：临场掷骰 r → 真实引擎 computeF/settleGame 决定胜负与 F（含体力日重置、
 *     体力消耗/晕倒、buff/好运签消耗、同步疲劳、对手加成）；赛后因果取引擎 reasonTags/pickReason。
 *   · NPC 对局：随机模拟胜负（仅展示），不影响玩家数值。
 *   · 全部结束后按真实名次结算（settleChamp/settleRunnerup/settleThird/settlePlace + FMVP），
 *     颁奖弹窗展示**真实的奖金 / 涨粉增量与 FMVP 归属**。
 * 作用域：整屏 overlay #koscreen（CSS 全部前缀作用域，见 styles.css）；元素 id 统一前缀 ko-。
 * 注：临场掷骰阶段不再走引擎内置 present()/manualDiceRoll/赛中事件/后悔药/名场面弹窗——这些
 *     交互页面会与整屏 overlay 冲突；此处仅取引擎的**核心结算数学**，保证赛果真实可追溯。
 * ===========================================================================*/
const KO_PALETTE = ['#e2b53e', '#2dd4bf', '#84cc16', '#fb923c', '#a78bfa', '#ef4444',
  '#22c55e', '#eab308', '#38bdf8', '#f59e0b', '#facc15', '#e11d48', '#c084fc', '#60a5fa'];
const KO_HUNTER = '#e85d9a';
const koPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 队伍头像：纯色背景 + 首字母大写（demov4.0feedback·NPC队伍）。
function koMono(name) {
  const s = (name || '').replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '');
  return (s.slice(0, 1) || '?').toUpperCase();
}
/* 每支队伍的固定代表色：按队名稳定哈希到调色板，全档（常规赛 / 季后赛 / 深渊 / 战报）一致。
 * 玩家队伍始终用 KO_HUNTER 高亮，不参与哈希。 */
function teamColor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return KO_PALETTE[h % KO_PALETTE.length];
}
function koOther(node, winner) { return node.slots[0] === winner ? node.slots[1] : node.slots[0]; }

/* demov4.1feedback2·深渊淘汰赛：队名下方标注赛区。按本局生成的各赛区队名池反查归属，
 * 玩家战队与 InStar 归国服；查不到（填充的 TeamN）兜底为国服。 */
const REGION_LABEL = { cn: "国服", jp: "日服", na: "北美", sea: "东南亚", hktw: "港澳台", kr: "韩服" };
function teamRegion(name) {
  if (!gameTeams || !name) { return "国服"; }
  if (name === P.teamName || name === gameTeams.fixed) { return "国服"; }
  for (const r of ["cn", "jp", "na", "sea", "hktw", "kr"]) {
    if ((gameTeams[r] || []).includes(name)) { return REGION_LABEL[r]; }
  }
  return "国服";
}

/* ---------- 构造季后赛 spec（双败淘汰 6 队，对齐 demo10-季后赛ui 节点 / 去向 / 布局） ---------- */
function buildSeasonSpec(kind, rank) {
  const pool = E.shuffle((gameTeams && gameTeams.domestic ? gameTeams.domestic : ['InStar']).filter((t) => t !== P.teamName));
  while (pool.length < 5) pool.push('Team' + (pool.length + 1));
  const teams = { P: { name: P.teamName, mono: koMono(P.teamName), color: KO_HUNTER, player: true } };
  const npc = [];
  for (let i = 0; i < 5; i++) { const k = 'N' + i; teams[k] = { name: pool[i], mono: koMono(pool[i]), color: teamColor(pool[i]) }; npc.push(k); }
  /* 种子位严格由常规赛排名决定（demov4.0feedback·季后赛）：
   *   常规赛第 1–4 名 → 胜者组（WR1：①vs④ / WR2：②vs③）；第 5–6 名 → 败者组（LR1：⑤vs⑥）。
   * 玩家落在自己常规赛名次对应的种子位，其余 5 个种子位依次由 NPC 填充。 */
  const myseed = Math.min(6, Math.max(1, rank || 6));
  const seeds = []; let ni = 0;
  for (let s = 1; s <= 6; s++) { seeds.push(s === myseed ? 'P' : npc[ni++]); }
  const nodes = {
    WR1: { code: 'WR1', day: 1, label: '胜者组 R1', slots: [seeds[0], seeds[3]], winner: null },
    WR2: { code: 'WR2', day: 1, label: '胜者组 R1', slots: [seeds[1], seeds[2]], winner: null },
    LR1: { code: 'LR1', day: 1, label: '败者组 R1', slots: [seeds[4], seeds[5]], winner: null },
    WR3: { code: 'WR3', day: 2, label: '胜者组决赛', slots: [null, null], winner: null },
    LR2: { code: 'LR2', day: 2, label: '败者组 R2', slots: [null, null], winner: null },
    LR3: { code: 'LR3', day: 3, label: '败者组 R3', slots: [null, null], winner: null },
    LR4: { code: 'LR4', day: 3, label: '败者组决赛', slots: [null, null], winner: null },
    GF: { code: 'GF', day: 4, label: '总决赛', slots: [null, null], winner: null },
  };
  const feed = {
    WR1: { win: ['WR3', 0], lose: ['LR3', 1], placeLose: null },
    WR2: { win: ['WR3', 1], lose: ['LR2', 1], placeLose: null },
    LR1: { win: ['LR2', 0], lose: null, placeLose: '第 6 名' },
    WR3: { win: ['GF', 0], lose: ['LR4', 1], placeLose: null },
    LR2: { win: ['LR3', 0], lose: null, placeLose: '第 5 名' },
    LR3: { win: ['LR4', 0], lose: null, placeLose: '第 4 名' },
    LR4: { win: ['GF', 1], lose: null, placeLose: '季军' },
    GF: { win: null, lose: null, placeLose: '亚军' },
  };
  const dayName = { WR1: '第一比赛日', WR2: '第一比赛日', LR1: '第一比赛日', WR3: '第二比赛日', LR2: '第二比赛日', LR3: '第三比赛日', LR4: '第三比赛日', GF: '总决赛日' };
  const PLACE6 = ['冠军', '亚军', '季军', '第 4 名', '第 5 名', '第 6 名'];
  return {
    variant: 'season', rootClass: 'season', playerKey: 'P', teams, nodes, feed,
    order: ['WR1', 'WR2', 'LR1', 'WR3', 'LR2', 'LR3', 'LR4', 'GF'], dayName,
    dayLabels: ['', '第一天', '第二天', '第三天', '第四天'],
    advLinks: [['WR1', 'WR3'], ['WR2', 'WR3'], ['WR3', 'GF'], ['LR1', 'LR2'], ['LR2', 'LR3'], ['LR3', 'LR4'], ['LR4', 'GF']],
    dropLinks: [['WR1', 'LR3'], ['WR2', 'LR2'], ['WR3', 'LR4']],
    finalKey: 'GF', thirdKey: null,
    stageOf: () => '季后', oppPop: E.OPP_POP['季后'], winPop: E.WIN_POP['季后'],
    oppBonusOf: (key) => (key === 'GF' || key === 'LR4') ? 2 : 0,
    boOf: () => 3, kind, logTag: `${kind}季赛·季后赛`,
    placeLabel: (p) => PLACE6[p - 1] || ('第 ' + p + ' 名'),
    champLabels: ['冠军', '亚军', '季军', '第4', '第5', '第6'], hasStandings: true,
    header: {
      titleA: `第 ${curYear} 赛年 · ${kind}季赛`, titleB: '季后赛晋级图',
      sub: 'TOURNAMENT BRACKET · 双败淘汰', ico: 'IVL', icoB: 'TOURNAMENT BRACKET',
      legendDrop: '败者降组', reportEy: 'PLAYOFF REPORT', reportTitle: `${kind}季赛 · 季后赛战报`,
      cerTitlePrefix: `${kind}季赛 · `, champLab: '总冠军', idRk: `常规赛第 ${rank} 名 · ${P.role}`,
    },
  };
}

/* ---------- 构造深渊淘汰赛 spec（12 队单败 + 季军赛，对齐 demo10-深渊ui） ---------- */
function buildAbyssSpec(groupRank) {
  const pool = E.shuffle(abyssPool().filter((t) => t !== P.teamName));
  while (pool.length < 11) pool.push('Team' + (pool.length + 1));
  const teams = { P: { name: P.teamName, mono: koMono(P.teamName), color: KO_HUNTER, player: true, region: teamRegion(P.teamName) } };
  const npc = [];
  for (let i = 0; i < 11; i++) { const k = 'N' + i; teams[k] = { name: pool[i], mono: koMono(pool[i]), color: teamColor(pool[i]), region: teamRegion(pool[i]) }; npc.push(k); }
  let gi = 0; const G = () => npc[gi++];
  const seedQF = groupRank === 1;   // 小组头名直进 8 强；第 2/3 名先打 12 进 8
  const groupSeeds = []; for (let i = 0; i < 4; i++) { groupSeeds.push(seedQF && i === 3 ? 'P' : G()); }
  const e = []; for (let i = 0; i < 8; i++) { e.push(!seedQF && i === 0 ? 'P' : G()); }
  const nodes = {
    M1: { code: 'MATCH 1', day: 1, round: '12 进 8', slots: [e[0], e[1]], winner: null },
    M2: { code: 'MATCH 2', day: 1, round: '12 进 8', slots: [e[2], e[3]], winner: null },
    M3: { code: 'MATCH 3', day: 1, round: '12 进 8', slots: [e[4], e[5]], winner: null },
    M4: { code: 'MATCH 4', day: 1, round: '12 进 8', slots: [e[6], e[7]], winner: null },
    M5: { code: 'MATCH 5', day: 2, round: '四分之一决赛', slots: [groupSeeds[0], null], winner: null },
    M6: { code: 'MATCH 6', day: 2, round: '四分之一决赛', slots: [groupSeeds[1], null], winner: null },
    M7: { code: 'MATCH 7', day: 3, round: '四分之一决赛', slots: [groupSeeds[2], null], winner: null },
    M8: { code: 'MATCH 8', day: 3, round: '四分之一决赛', slots: [groupSeeds[3], null], winner: null },
    M9: { code: 'MATCH 9', day: 4, round: '半决赛', slots: [null, null], winner: null },
    M10: { code: 'MATCH 10', day: 4, round: '半决赛', slots: [null, null], winner: null },
    M11: { code: 'MATCH 11', day: 5, round: '季军赛', slots: [null, null], winner: null },
    M12: { code: 'MATCH 12', day: 5, round: '总决赛', slots: [null, null], winner: null },
  };
  const feed = {
    M1: { win: ['M5', 1], lose: null, placeLose: '12 强' },
    M2: { win: ['M6', 1], lose: null, placeLose: '12 强' },
    M3: { win: ['M7', 1], lose: null, placeLose: '12 强' },
    M4: { win: ['M8', 1], lose: null, placeLose: '12 强' },
    M5: { win: ['M9', 0], lose: null, placeLose: '8 强' },
    M6: { win: ['M9', 1], lose: null, placeLose: '8 强' },
    M7: { win: ['M10', 0], lose: null, placeLose: '8 强' },
    M8: { win: ['M10', 1], lose: null, placeLose: '8 强' },
    M9: { win: ['M12', 0], lose: ['M11', 0], placeLose: null },
    M10: { win: ['M12', 1], lose: ['M11', 1], placeLose: null },
    M11: { win: null, lose: null, placeLose: '第 4 名' },
    M12: { win: null, lose: null, placeLose: '亚军' },
  };
  const order = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  const dayName = {}; order.forEach((k) => { dayName[k] = ['', '第一比赛日', '第二比赛日', '第三比赛日', '第四比赛日', '第五比赛日'][nodes[k].day]; });
  const rankLabel = (i) => i < 4 ? ['冠军', '亚军', '季军', '第 4 名'][i] : (i < 8 ? '8 强' : '12 强');
  const grName = ['', '一', '二', '三'][groupRank] || groupRank;
  return {
    variant: 'abyss', rootClass: 'abyss', playerKey: 'P', teams, nodes, feed, order, dayName,
    dayLabels: ['', '第一天', '第二天', '第三天', '第四天', '第五天'],
    links: [
      ['M1', 'r', 'M5', 'l', 'adv'], ['M2', 'r', 'M6', 'l', 'adv'],
      ['M5', 'r', 'M9', 'l', 'adv'], ['M6', 'r', 'M9', 'l', 'adv'], ['M9', 'r', 'M12', 'l', 'adv'],
      ['M3', 'l', 'M7', 'r', 'adv'], ['M4', 'l', 'M8', 'r', 'adv'],
      ['M7', 'l', 'M10', 'r', 'adv'], ['M8', 'l', 'M10', 'r', 'adv'], ['M10', 'l', 'M12', 'r', 'adv'],
      ['M9', 'r', 'M11', 'l', 'drop'], ['M10', 'l', 'M11', 'r', 'drop'],
    ],
    finalKey: 'M12', thirdKey: 'M11',
    stageOf: (key) => nodes[key].round === '12 进 8' ? '12进8' : '总决',
    oppPop: E.OPP_POP['深渊'], winPop: E.WIN_POP['总决'],
    oppBonusOf: (key) => ['M9', 'M10', 'M11', 'M12'].includes(key) ? 2 : 0,
    boOf: (key) => nodes[key].round === '12 进 8' ? 2 : 3,
    kind: '深渊', logTag: '深渊·淘汰赛',
    placeLabel: (p) => rankLabel(p - 1), hasStandings: false,
    header: {
      titleA: `第 ${curYear} 赛年 · 深渊的呼唤`, titleB: '淘汰赛晋级图',
      sub: 'GLOBAL FINALS · 12 强单败淘汰', ico: '深渊的呼唤', icoB: '淘汰赛阶段',
      legendDrop: '半决赛败者 · 季军赛', reportEy: 'ABYSS REPORT', reportTitle: '深渊的呼唤 · 淘汰赛战报',
      cerTitlePrefix: '深渊的呼唤 · ', champLab: '全球总冠军', idRk: `小组第${grName} · ${P.role}`,
    },
  };
}

/* ---------- 纯逻辑：结算节点 / 比分合成 / 名次推导（无 DOM，供 UI 与冲烟共用） ---------- */
function koSynthScore(spec, key, winnerKey) {
  const node = spec.nodes[key], bo = spec.boOf(key), lw = E.randint(0, bo - 1);
  const a = (node.slots[0] === winnerKey) ? bo : lw;
  const b = (node.slots[1] === winnerKey) ? bo : lw;
  node.score = a + ' : ' + b;
}
function koResolve(spec, key, winnerKey) {
  koSynthScore(spec, key, winnerKey);
  const node = spec.nodes[key]; node.winner = winnerKey;
  const loser = koOther(node, winnerKey), f = spec.feed[key];
  if (f.win) spec.nodes[f.win[0]].slots[f.win[1]] = winnerKey;
  if (f.lose) spec.nodes[f.lose[0]].slots[f.lose[1]] = loser;
}
function koFinalize(spec) {
  for (const key of spec.order) {
    const node = spec.nodes[key];
    if (node.winner !== null) continue;
    const s = node.slots;
    let w = (s[0] && s[1]) ? (Math.random() < 0.5 ? s[0] : s[1]) : (s[0] || s[1]);
    if (!w) continue;
    koResolve(spec, key, w);
  }
}
function koStandings(spec) {
  const N = spec.nodes;
  if (spec.variant === 'season') {
    const out = [null, null, null, null, null, null];
    if (N.GF.winner) { out[0] = N.GF.winner; out[1] = koOther(N.GF, N.GF.winner); }
    if (N.LR4.winner) out[2] = koOther(N.LR4, N.LR4.winner);
    if (N.LR3.winner) out[3] = koOther(N.LR3, N.LR3.winner);
    if (N.LR2.winner) out[4] = koOther(N.LR2, N.LR2.winner);
    if (N.LR1.winner) out[5] = koOther(N.LR1, N.LR1.winner);
    return out;
  }
  const out = new Array(12).fill(null);
  if (N.M12.winner) { out[0] = N.M12.winner; out[1] = koOther(N.M12, N.M12.winner); }
  if (N.M11.winner) { out[2] = N.M11.winner; out[3] = koOther(N.M11, N.M11.winner); }
  ['M5', 'M6', 'M7', 'M8'].forEach((c, i) => { const n = N[c]; if (n.winner) out[4 + i] = koOther(n, n.winner); });
  ['M1', 'M2', 'M3', 'M4'].forEach((c, i) => { const n = N[c]; if (n.winner) out[8 + i] = koOther(n, n.winner); });
  return out;
}
function koRecords(spec) {
  const rec = {}; Object.keys(spec.teams).forEach((k) => rec[k] = { w: 0, l: 0 });
  spec.order.forEach((key) => { const n = spec.nodes[key]; if (n.winner === null) return; rec[n.winner].w++; rec[koOther(n, n.winner)].l++; });
  return rec;
}

/* 真实引擎驱动一场玩家对局（无 UI）：忠实复刻 playMatch 的体力 / buff / 同步疲劳口径，
 * 但跳过赛中事件 / 后悔药 / 名场面等交互页面（与整屏 overlay 冲突）。winOverride 仅供冲烟强制赛果。 */
function koDecidePlayer(spec, key, r, winOverride) {
  const node = spec.nodes[key];
  const stage = spec.stageOf(key);
  const dayFirst = node.day !== spec._lastDay; spec._lastDay = node.day;
  if (dayFirst) { P.stamina = E.matchStartStamina(P); P.fired_events = new Set(); }
  const staBefore = P.stamina;
  P.stamina = Math.max(0, P.stamina - E.gameCost(stage));   // 体力下限 0（demov4.1feedback）
  P._lastStaCost = Math.round(staBefore - P.stamina);
  const fainted = P.stamina <= 0;
  const buff = P.nextGameBuff; P.nextGameBuff = 0;
  const noBad = P.nextNoBadRoll; P.nextNoBadRoll = false;
  const oppBonus = spec.oppBonusOf(key);
  const cf = E.computeF(P, stage, spec.oppPop, curYear, oppBonus, 0, buff, r, noBad);
  const sg = E.settleGame(P, stage, spec.oppPop, spec.winPop, curYear, cf.F, fainted, oppBonus);
  spec._fList.push(cf.F);
  let win = sg.win; if (winOverride != null) win = (!!winOverride) && !fainted;
  const tags = E.reasonTags(P, { stage, win, keyMatch: oppBonus > 0, F: cf.F, opp: sg.opp, team: sg.team, cheer: cf.cheer, fainted, year: curYear, age: curAge });
  const reason = E.pickReason(tags, win);
  if (typeof renderHUD === 'function') renderHUD();
  return { win, F: cf.F, fainted, reason };
}

/* 冲烟用：无 UI / 无动画跑完整张图，玩家场走真实引擎结算，返回 {place, fList}。 */
function koRunHeadless(spec, winProb) {
  spec._fList = []; spec._lastDay = null;
  for (const key of spec.order) {
    const node = spec.nodes[key];
    if (node.winner !== null) continue;
    if (node.slots.includes(spec.playerKey)) {
      const V = E.fluctV(P); const r = E.rollFluct(V, P.nextNoBadRoll);
      const wo = (winProb != null) ? (Math.random() < winProb) : null;
      const out = koDecidePlayer(spec, key, r, wo);
      koResolve(spec, key, out.win ? spec.playerKey : koOther(node, spec.playerKey));
    } else {
      koResolve(spec, key, Math.random() < 0.5 ? node.slots[0] : node.slots[1]);
    }
  }
  const st = koStandings(spec);
  return { place: st.indexOf(spec.playerKey) + 1, fList: spec._fList };
}

/* ---------- 战报弹窗 HTML（hero + 名次列表）：供 UI 注入与冲烟长度校验 ---------- */
function koRepHeroHTML(spec) {
  const st = koStandings(spec).map((r) => r), my = st.indexOf(spec.playerKey), pt = spec.teams[spec.playerKey];
  return `<div class="phr">YOUR TEAM · 你的战队</div>`
    + `<div class="phteam"><span class="repcrest" style="--tc:${pt.color}">${pt.mono}</span><span class="phn">${pt.name}</span></div>`
    + `<div class="phplace">${spec.placeLabel(my + 1)}</div>`;
}
function koRepRankHTML(spec) {
  const ranks = koStandings(spec), rec = koRecords(spec);
  return ranks.map((team, i) => {
    if (!team) return `<div class="rep-row r${i + 1}"><span class="pl mono">${spec.placeLabel(i + 1)}</span><span class="nm" style="color:var(--dim);font-style:italic">待定</span></div>`;
    const tt = spec.teams[team];
    return `<div class="rep-row r${i + 1}${team === spec.playerKey ? ' mine' : ''}">`
      + `<span class="pl mono">${spec.placeLabel(i + 1)}</span>`
      + `<span class="repcrest" style="--tc:${tt.color}">${tt.mono}</span>`
      + `<span class="nm">${tt.name}${team === spec.playerKey ? ' · 你' : ''}</span>`
      + `<span class="rec mono">${rec[team].w}W ${rec[team].l}L</span></div>`;
  }).join('');
}
function koReportHTML(spec) { return koRepHeroHTML(spec) + koRepRankHTML(spec); }

/* ---------- 右栏晋级图骨架（节点容器，按 demo10 精确定位） ---------- */
function koBracketHTML(spec) {
  if (spec.variant === 'season') {
    return `<div class="field" id="ko-field"><svg class="links" id="ko-links"></svg>
      <div class="daycols">
        <div class="daycol"><div class="d">Day 1</div></div>
        <div class="daycol"><div class="d">Day 2</div></div>
        <div class="daycol"><div class="d">Day 3</div></div>
        <div class="daycol"><div class="d">Day 4</div></div>
        <div class="daycol"><div class="d fin">冠军</div></div>
      </div>
      <div class="grid">
        <div class="col">
          <span class="band win">胜者组 · WINNERS</span>
          <div class="node" id="ko-node-WR1" style="top:16px"></div>
          <div class="node" id="ko-node-WR2" style="top:124px"></div>
          <span class="band lose">败者组 · LOSERS</span>
          <div class="node" id="ko-node-LR1" style="top:236px"></div>
        </div>
        <div class="col">
          <div class="node" id="ko-node-WR3" style="top:70px"></div>
          <div class="node" id="ko-node-LR2" style="top:236px"></div>
        </div>
        <div class="col">
          <div class="node" id="ko-node-LR3" style="top:236px"></div>
          <div class="node" id="ko-node-LR4" style="top:344px"></div>
        </div>
        <div class="col">
          <div class="node" id="ko-node-GF" style="top:207px"></div>
        </div>
        <div class="col">
          <div class="champ pending" id="ko-champ" style="top:130px">
            <div class="trophy">🏆</div><div class="lab">CHAMPION</div>
            <div class="who" id="ko-champName">待定</div>
            <div class="standings" id="ko-standings"></div>
          </div>
        </div>
      </div></div>`;
  }
  return `<div class="field" id="ko-field"><svg class="links" id="ko-links"></svg>
    <div class="daycols">
      <div class="daycol"><div class="d">12 进 8</div><div class="t">BO3</div></div>
      <div class="daycol"><div class="d">四分之一决赛</div><div class="t">BO5</div></div>
      <div class="daycol"><div class="d">半决赛</div><div class="t">BO5</div></div>
      <div class="daycol"><div class="d fin">总决赛 / 季军赛</div><div class="t">BO5</div></div>
      <div class="daycol"><div class="d">半决赛</div><div class="t">BO5</div></div>
      <div class="daycol"><div class="d">四分之一决赛</div><div class="t">BO5</div></div>
      <div class="daycol"><div class="d">12 进 8</div><div class="t">BO3</div></div>
    </div>
    <div class="grid">
      <div class="col"><div class="node" id="ko-node-M1" style="top:55px"></div><div class="node" id="ko-node-M2" style="top:300px"></div></div>
      <div class="col"><div class="node" id="ko-node-M5" style="top:30px"></div><div class="node" id="ko-node-M6" style="top:275px"></div></div>
      <div class="col"><div class="node" id="ko-node-M9" style="top:150px"></div></div>
      <div class="col">
        <div class="champ pending" id="ko-champ" style="top:0"><div class="trophy">🏆</div><div class="lab">CHAMPION</div><div class="who" id="ko-champName">待定</div></div>
        <div class="node final" id="ko-node-M12" style="top:160px"></div>
        <div class="node third" id="ko-node-M11" style="top:312px"></div>
      </div>
      <div class="col"><div class="node" id="ko-node-M10" style="top:150px"></div></div>
      <div class="col"><div class="node" id="ko-node-M7" style="top:30px"></div><div class="node" id="ko-node-M8" style="top:275px"></div></div>
      <div class="col"><div class="node" id="ko-node-M3" style="top:55px"></div><div class="node" id="ko-node-M4" style="top:300px"></div></div>
    </div></div>`;
}

/* ---------- 整屏 overlay 完整 HTML（复刻 demo10：topbar + 左栏 + 右栏 + 三个弹窗） ---------- */
const KO_KNIFE = (fill) => `<svg viewBox="0 0 76 18"><circle cx="4" cy="9" r="3.4" fill="#9c8757"/><rect x="6" y="6.5" width="14" height="5" rx="2.5" fill="#5d4a28"/><rect x="20" y="2.5" width="4.5" height="13" rx="2" fill="#c9a24a"/><path d="M25 6 L66 8.2 L74 9 L66 9.8 L25 12 Z" fill="${fill}"/><path d="M25 8 L66 8.7 L74 9 L66 9 L25 9 Z" fill="rgba(255,255,255,.5)"/></svg>`;
const KO_PIPS = '<i class="p1"></i><i class="p2"></i><i class="p3"></i><i class="p4"></i><i class="p5"></i><i class="p6"></i><i class="p7"></i><i class="p8"></i><i class="p9"></i>';
function koOverlayHTML(spec) {
  const h = spec.header;
  return `<div id="koscreen" class="${spec.rootClass}">
  <div class="ko-top">
    <div class="brand"><span class="logo">IVL</span>
      <div><div class="ttl">${h.titleA} · <b>${h.titleB}</b></div><div class="sub">${h.sub}</div></div></div>
    <div class="spacer"></div>
    <button class="ko-bagbtn" id="ko-bagBtn" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      背包<span class="ko-bagbadge" id="ko-bagBadge">0</span>
    </button>
    <button class="ko-bagbtn" id="ko-attrBtn" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4z"/></svg>
      个人属性
    </button>
    <div class="idchip"><span class="dot"></span>
      <div><div class="nm">${P.name}</div><div class="rk">${h.idRk}</div></div></div>
  </div>
  <div class="ko-layout">
    <aside class="side">
      <div class="side-head">
        <div><div class="lab">LIVE · 赛况推进</div><h2 id="ko-sideTitle">第一比赛日</h2></div>
      </div>
      <div class="ko-stam" id="ko-stamPanel"></div>
      <div class="progress"><div class="bar"><i id="ko-progBar"></i></div>
        <div class="row"><span id="ko-progText"></span><span id="ko-progDay"></span></div></div>
      <div class="matchcard">
        <div class="mc-meta"><span class="mc-day" id="ko-mcDay"></span><span class="mc-stage" id="ko-mcStage"></span><span class="mc-code mono" id="ko-mcCode"></span></div>
        <div class="versus">
          <div id="ko-vsA"></div>
          <div class="clashzone" id="ko-clash">
            <span class="knife left">${KO_KNIFE('#d7dde8')}</span>
            <span class="knife right">${KO_KNIFE('#f5cf6a')}</span>
            <span class="spark"></span><span class="vsword mono" id="ko-vsWord">VS</span>
          </div>
          <div id="ko-vsB"></div>
        </div>
        <div class="roll" id="ko-rollBox">
          <div class="dice"><span class="die" id="ko-rollDie" data-face="1" aria-hidden="true">${KO_PIPS}</span><span class="v mono" id="ko-rollVal">--</span><span class="tier" id="ko-rollTier">—</span></div>
          <div class="fb" id="ko-rollFb"></div>
        </div>
        <div class="result" id="ko-resultBox">
          <div class="rh"><span class="bar"></span><b>本场结果</b><span class="score mono" id="ko-resScore"></span></div>
          <div class="cause" id="ko-resCause"></div><div class="place" id="ko-resPlace"></div>
        </div>
      </div>
      <div class="actions">
        <button class="bigbtn" id="ko-actBtn">开始比赛</button>
        <button class="bigbtn ceremony" id="ko-ceremonyBtn" style="display:none">颁奖</button>
        <button class="bigbtn skip" id="ko-skipBtn" style="display:none">跳过 NPC · 直达我的下一场</button>
        <div class="hint" id="ko-actHint">点击开始这一场的对局结算</div>
      </div>
    </aside>
    <main class="bracketwrap">
      <div class="bracket-title"><span class="ico">${h.ico} <b>${h.icoB}</b></span>
        <div class="legend"><span class="adv"><i></i>胜者晋级</span><span class="drop"><i></i>${h.legendDrop}</span></div></div>
      ${koBracketHTML(spec)}
    </main>
  </div>
  <div class="modal" id="ko-modal"><div class="sheet">
    <div class="sh"><div class="crest">${spec.teams.P.mono}</div>
      <div><div class="id">${P.name}</div><div class="role">${P.role} · ${spec.variant === 'abyss' ? '深渊淘汰赛' : '季后赛'} · 首发</div></div>
      <button class="x" id="ko-modalX" aria-label="关闭">×</button></div>
    <div class="radarbox" id="ko-radarBox"></div><div class="bars" id="ko-statBars"></div>
    <div class="moneyrow"><span class="k">资金</span><span class="mv mono" id="ko-moneyVal"></span></div>
    <div class="note">临场发挥的随机浮动区间由 <b>稳定性</b> 决定（稳定性越高，浮动越小、越不容易失常）。本场赛果由个人六维 + 临场发挥 + 队友实力共同结算。</div>
  </div></div>
  <div class="bagx-modal" id="ko-bag"><div class="bagx-sheet">
    <div class="bagx-head"><div><div class="ttl">背包 · 加成道具</div><div class="sub" id="ko-bagTip">道具仅在你的下一场开打前可用</div></div><button class="bagx-x" id="ko-bagX" aria-label="关闭">×</button></div>
    <div class="bagx-list" id="ko-bagList"></div>
  </div></div>
  <div class="modal" id="ko-report"><div class="sheet report">
    <div class="rep-head"><div><div class="ey">${h.reportEy}</div><div class="ttl">${h.reportTitle}</div></div>
      <button class="x" id="ko-reportX" aria-label="关闭">×</button></div>
    <div class="rep-hero" id="ko-repHero"></div>
    <div class="rep-sub">最终排名 · FINAL STANDINGS</div>
    <div class="rep-rank" id="ko-repRank"></div>
  </div></div>
  <div class="modal" id="ko-ceremony"><div class="sheet cer">
    <button class="x" id="ko-ceremonyX" aria-label="关闭">×</button>
    <div class="cer-stage"><div class="ribbons" id="ko-cerRibbons"></div>
      <div class="cer-ey">AWARD · 颁奖</div><div class="cer-trophy">🏆</div>
      <div class="cer-lab" id="ko-cerLab"></div><div class="cer-champ" id="ko-cerChamp"></div>
      <div class="cer-fmvp" id="ko-cerFmvp"></div></div>
    <div class="cer-rewards">
      <div class="cer-rw"><div class="rw-lab" id="ko-cerMoneyLab">冠军奖金</div><div class="rw-val" id="ko-cerMoney"></div></div>
      <div class="cer-rw"><div class="rw-lab">粉丝增长</div><div class="rw-val" id="ko-cerFans"></div></div>
    </div>
    <button class="bigbtn cer-fmvp" id="ko-cerFmvpBtn" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.6 6.6L21.5 9l-5.2 4.4L18 21l-6-3.6L6 21l1.7-7.6L2.5 9l6.9-.4L12 2z"/></svg>FMVP</button>
    <button class="bigbtn cer-done" id="ko-cerDone">完成，返回生涯</button>
  </div></div>
</div>`;
}

/* ---------- 整屏 overlay 控制器：复刻 demo10 流程，玩家场走真实引擎结算，结束后真实结算 + 颁奖 ---------- *
 * 返回 Promise<{place, fList}>，在玩家点「完成，返回生涯」（颁奖弹窗）后 resolve 并销毁 overlay。 */
function runKnockoutScreen(spec) {
  return new Promise((resolve) => {
    spec._fList = []; spec._lastDay = null; spec._reward = null;
    const host = (typeof document !== 'undefined' && document.body) ? document.body : null;
    if (!host) { resolve(koRunHeadless(spec, null)); return; }   // 无 DOM（极端环境）退化为无头结算
    const holder = document.createElement('div');
    holder.innerHTML = koOverlayHTML(spec);
    host.appendChild(holder.firstElementChild);

    const FAST = !!(typeof window !== 'undefined' && window.__KO_FAST);
    const T = (ms) => FAST ? 0 : ms;
    const raf = (cb) => (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(cb) : setTimeout(cb, 0);
    const kq = (id) => document.getElementById('ko-' + id);
    const nodeEl = (key) => document.getElementById('ko-node-' + key);
    const isPlayerMatch = (key) => spec.nodes[key].slots.includes(spec.playerKey);

    let idx = 0, phase = 'ready', lastRoll = null, autoTimer = null, clashTimer = null, finished = false, settled = false;
    // 统一清理所有挂起定时器：autoTimer(排程下一步) 与 clashTimer(刀光动画回调)。
    // 必须同时清,否则「跳过 NPC / 进入下一场」时残留的 clash 回调会延后触发,
    // 在错误的 idx 上二次结算,导致落到对手槽位仍为 null(待定) 的总决赛而卡死。
    function clearTimers() { clearTimeout(autoTimer); clearTimeout(clashTimer); autoTimer = null; clashTimer = null; }
    // 选出有效胜者:双方就位则随机,只有一方就位则视为轮空,均未就位返回 null(交由收尾结算兜底)。
    function koAutoWinner(node) { const s = node.slots; if (s[0] && s[1]) { return Math.random() < 0.5 ? s[0] : s[1]; } return s[0] || s[1] || null; }

    /* --- 晋级图节点渲染 --- */
    function rowHTML(teamKey, node, key) {
      if (!teamKey) return `<div class="row tbd"><span class="cc">?</span><span class="rn">待定</span></div>`;
      const t = spec.teams[teamKey];
      const resolved = node.winner !== null;
      const isWin = resolved && node.winner === teamKey, isLose = resolved && !isWin;
      let cls = 'row' + (isWin ? ' winrow' : '') + (isLose ? ' loserow' : '') + (t.player ? ' you' : '');
      let score = '';
      if (resolved && node.score) { const p = node.score.split(' : '); score = (node.slots[0] === teamKey) ? p[0] : p[1]; }
      let placeTag = '';
      const f = spec.feed[key];
      if (isLose && f && f.placeLose && key !== spec.finalKey && key !== spec.thirdKey) placeTag = `<span class="placetag">${f.placeLose}</span>`;
      return `<div class="${cls}"><span class="cc" style="--tc:${t.color}">${t.mono}</span><span class="rn">${t.name}</span>${placeTag}${resolved ? `<span class="rs">${score}</span>` : ''}</div>`;
    }
    function renderNode(key) {
      const node = spec.nodes[key], el = nodeEl(key); if (!el) return;
      const cur = spec.order[idx];
      const isCurrent = !finished && cur === key && node.winner === null;
      const hasPlayer = node.slots.includes(spec.playerKey);
      const special = key === spec.finalKey && spec.variant === 'abyss' ? ' final' : (key === spec.thirdKey ? ' third' : '');
      const st = node.winner !== null ? '已结束' : (isCurrent ? '进行中' : '待开始');
      el.className = 'node' + special + (isCurrent ? ' current' : '') + (hasPlayer ? ' player-node' : '');
      el.innerHTML = `<div class="nh"><span class="code mono">${node.code}</span><span class="st">${st}</span></div>`
        + rowHTML(node.slots[0], node, key) + rowHTML(node.slots[1], node, key);
    }
    function renderChampion() {
      const fk = spec.nodes[spec.finalKey], champEl = kq('champ'), nameEl = kq('champName');
      if (!champEl) return;
      if (fk.winner) { champEl.classList.remove('pending'); const t = spec.teams[fk.winner]; nameEl.textContent = t.name; nameEl.style.color = t.color; }
      else { champEl.classList.add('pending'); nameEl.textContent = '待定'; nameEl.style.color = ''; }
      if (spec.hasStandings) {
        const stand = kq('standings'); if (!stand) return;
        const ranks = koStandings(spec);
        stand.innerHTML = ranks.map((team, i) => {
          const t = team ? spec.teams[team] : null;
          const cls = 'srow r' + (i + 1) + (team === spec.playerKey ? ' mine' : '') + (team ? '' : ' dim');
          return `<div class="${cls}"><span class="rk">${spec.champLabels[i]}</span>`
            + (t ? `<span class="cc" style="--tc:${t.color};width:18px;height:18px;font-size:8px;border-radius:5px">${t.mono}</span><span class="nm">${t.name}</span>`
              : `<span class="nm" style="color:var(--dim);font-style:italic">待定</span>`) + `</div>`;
        }).join('');
      }
    }
    function renderBracket() { spec.order.forEach(renderNode); renderChampion(); }

    /* --- 连接线 --- */
    function drawLinks() {
      const svg = kq('links'), field = kq('field'); if (!svg || !field) return;
      const fr = field.getBoundingClientRect();
      svg.setAttribute('width', field.scrollWidth); svg.setAttribute('height', field.scrollHeight);
      const anchor = (code, side) => { const el = nodeEl(code); if (!el) return { x: 0, y: 0 }; const r = el.getBoundingClientRect(); return { x: side === 'r' ? r.right - fr.left : r.left - fr.left, y: r.top - fr.top + r.height / 2 }; };
      const elbow = (a, b) => { const mx = (a.x + b.x) / 2; return `M${a.x} ${a.y} H${mx} V${b.y} H${b.x}`; };
      let h = '';
      if (spec.variant === 'season') {
        spec.advLinks.forEach(([s, t]) => { const a = anchor(s, 'r'), b = anchor(t, 'l'); h += `<path d="${elbow(a, b)}" fill="none" stroke="rgba(245,207,106,.45)" stroke-width="2"/>`; });
        spec.dropLinks.forEach(([s, t]) => { const a = anchor(s, 'r'), b = anchor(t, 'l'); h += `<path d="${elbow(a, b)}" fill="none" stroke="rgba(232,93,154,.4)" stroke-width="1.6" stroke-dasharray="5 4"/>`; });
        const a = anchor(spec.finalKey, 'r'), cr = kq('champ').getBoundingClientRect();
        h += `<path d="${elbow(a, { x: cr.left - fr.left, y: cr.top - fr.top + 34 })}" fill="none" stroke="rgba(245,207,106,.55)" stroke-width="2.4"/>`;
      } else {
        spec.links.forEach(([s, ss, t, ts, type]) => {
          const a = anchor(s, ss), b = anchor(t, ts);
          const stroke = type === 'adv' ? 'rgba(245,207,106,.45)' : 'rgba(232,93,154,.4)';
          const extra = type === 'adv' ? 'stroke-width="2"' : 'stroke-width="1.6" stroke-dasharray="5 4"';
          h += `<path d="${elbow(a, b)}" fill="none" stroke="${stroke}" ${extra}/>`;
        });
        const cr = kq('champ').getBoundingClientRect(), gr = nodeEl(spec.finalKey).getBoundingClientRect();
        const cx = cr.left - fr.left + cr.width / 2;
        h += `<path d="M${cx} ${gr.top - fr.top} V${cr.bottom - fr.top}" fill="none" stroke="rgba(245,207,106,.55)" stroke-width="2.4"/>`;
      }
      svg.innerHTML = h;
    }
    function rafLinks() { raf(drawLinks); }

    /* --- 左栏比赛卡 --- */
    function teamCardHTML(teamKey, node) {
      if (!teamKey) return `<div class="tcard"><span class="crest" style="--tc:#3a4762">?</span><div class="info"><div class="nm" style="color:var(--dim)">待定</div></div></div>`;
      const t = spec.teams[teamKey], resolved = node.winner !== null;
      const isWin = resolved && node.winner === teamKey, isLose = resolved && !isWin;
      const cls = 'tcard' + (t.player ? ' player' : '') + (isWin ? ' win' : '') + (isLose ? ' lose' : '');
      // demov4.1feedback2·深渊淘汰赛：队名下方标注赛区（仅深渊存在跨赛区对阵）。
      const rg = (spec.variant === 'abyss' && t.region) ? `<div class="rg">${t.region}</div>` : '';
      return `<div class="${cls}"><span class="crest" style="--tc:${t.color}">${t.mono}</span><div class="info"><div class="nm">${t.name}${t.player ? '<span class="you">YOU</span>' : ''}</div>${rg}</div></div>`;
    }
    function placeText(key) {
      const node = spec.nodes[key], loser = koOther(node, node.winner), f = spec.feed[key];
      const wN = spec.teams[node.winner].name, lN = spec.teams[loser].name;
      if (key === spec.finalKey) return `${wN} → 冠军 · ${lN} → 亚军`;
      if (key === spec.thirdKey) return `${wN} → 季军 · ${lN} → 第 4 名`;
      if (f.lose) return `${lN} → ${spec.nodes[f.lose[0]].round || spec.nodes[f.lose[0]].label}`;
      if (f.placeLose) return `${lN} → ${f.placeLose}`;
      return '';
    }
    function renderSide() {
      const key = spec.order[idx], node = spec.nodes[key], isPlayer = isPlayerMatch(key);
      kq('sideTitle').textContent = spec.dayName[key];
      kq('mcDay').textContent = spec.dayLabels[node.day];
      kq('mcStage').textContent = node.label || node.round;
      kq('mcCode').textContent = node.code;
      kq('progText').textContent = `MATCH ${idx + 1} / ${spec.order.length}`;
      kq('progDay').textContent = `DAY ${node.day}`;
      kq('progBar').style.width = ((idx + (phase === 'result' ? 1 : 0)) / spec.order.length * 100) + '%';
      { const sp = kq('stamPanel'); if (sp) { sp.innerHTML = staminaPanelHtml(E.gameCost(spec.stageOf(key))); } }
      kq('vsA').innerHTML = teamCardHTML(node.slots[0], node);
      kq('vsB').innerHTML = teamCardHTML(node.slots[1], node);
      kq('vsWord').textContent = phase === 'result' ? '' : 'VS';
      kq('rollBox').classList.toggle('show', !!lastRoll);
      const res = kq('resultBox');
      if (phase === 'result') {
        res.classList.add('show');
        kq('resScore').textContent = node.score || '';
        kq('resCause').textContent = node._cause || '';
        kq('resPlace').textContent = node.winner !== null ? placeText(key) : '';
      } else res.classList.remove('show');
      renderActions(isPlayer);
      updateKoBagBadge();
    }
    function renderActions(isPlayer) {
      const btn = kq('actBtn'), hint = kq('actHint'), skip = kq('skipBtn'), cer = kq('ceremonyBtn');
      btn.className = 'bigbtn'; btn.disabled = false; btn.style.display = ''; skip.style.display = 'none'; cer.style.display = 'none';
      const reportLabel = spec.variant === 'abyss' ? '查看深渊战报' : '查看季后赛战报';
      if (phase === 'ready') {
        if (isPlayer) { btn.classList.add('player'); btn.textContent = '该你上场了'; hint.textContent = ''; }
        else { btn.style.display = 'none'; skip.style.display = 'block'; hint.textContent = 'NPC 比赛自动逐场结算中…'; }
      } else if (phase === 'rolling') {
        btn.disabled = true; btn.classList.add('player'); btn.textContent = '投掷中…'; hint.textContent = '临场状态结算中';
      } else if (phase === 'clash') {
        if (isPlayer) { btn.disabled = true; btn.textContent = '对局进行中…'; hint.textContent = '刀光相接，胜负将分'; }
        else { btn.style.display = 'none'; skip.style.display = 'block'; hint.textContent = '对局进行中…'; }
      } else if (phase === 'result') {
        if (idx >= spec.order.length - 1) { btn.classList.add('next'); btn.textContent = reportLabel; cer.style.display = 'block'; hint.textContent = ''; }
        else if (isPlayer) { btn.classList.add('next'); btn.textContent = '下一场 →'; hint.textContent = ''; }
        else { btn.style.display = 'none'; skip.style.display = 'block'; hint.textContent = 'NPC 比赛自动推进中…'; }
      }
    }

    /* --- 流程 --- */
    function resetBoxes() { lastRoll = null; kq('rollBox').classList.remove('show'); kq('resultBox').classList.remove('show'); kq('clash').classList.remove('go'); kq('vsWord').textContent = 'VS'; }
    function playClash(cb) { const cz = kq('clash'); cz.classList.remove('go'); void cz.offsetWidth; cz.classList.add('go'); clashTimer = setTimeout(cb, T(1050)); }
    function enterMatch() {
      clearTimers();
      phase = 'ready'; resetBoxes(); renderSide(); renderBracket(); rafLinks();
      if (!isPlayerMatch(spec.order[idx])) autoTimer = setTimeout(runNpcMatch, T(700));
    }
    function runNpcMatch() {
      phase = 'clash'; renderSide();
      playClash(() => {
        if (finished) { return; }
        const key = spec.order[idx], node = spec.nodes[key];
        if (node.winner === null) {
          const w = koAutoWinner(node);
          if (w === null) { if (idx < spec.order.length - 1) { autoTimer = setTimeout(autoAdvance, T(300)); } else { scheduleReport(); } return; }
          koResolve(spec, key, w);
          node._cause = `${spec.teams[w].name} ${node.score} ${koPick(['力克', '击败', '送走', '战胜', '力压'])} ${spec.teams[koOther(node, w)].name}。`;
        }
        phase = 'result'; renderSide(); renderBracket(); rafLinks();
        if (idx < spec.order.length - 1) autoTimer = setTimeout(autoAdvance, T(1150)); else scheduleReport();
      });
    }
    function autoAdvance() { if (idx < spec.order.length - 1) { idx++; enterMatch(); } else finish(); }
    function doRoll() {
      phase = 'rolling'; renderActions(true);
      const V = E.fluctV(P); const r = E.rollFluct(V, P.nextNoBadRoll); const dt = E.diceTier(r, V);
      lastRoll = { r, tier: dt.tier, name: dt.sub, fb: dt.text };
      const dieEl = kq('rollDie'), valEl = kq('rollVal'), tierEl = kq('rollTier'), fbEl = kq('rollFb');
      kq('rollBox').classList.add('show');
      const settle = () => {
        dieEl.classList.remove('rolling'); dieEl.dataset.face = lastRoll.tier; dieEl.classList.add('settle');
        valEl.textContent = (r >= 0 ? '+' : '') + r.toFixed(1);
        tierEl.textContent = lastRoll.name; tierEl.className = 'tier ' + (lastRoll.tier <= 2 ? 'tier-bad' : (lastRoll.tier <= 4 ? 'tier-mid' : 'tier-good'));
        fbEl.textContent = lastRoll.fb;
        setTimeout(runPlayerClash, T(950));
      };
      if (FAST) { settle(); return; }
      dieEl.classList.remove('settle'); dieEl.classList.add('rolling');
      valEl.textContent = '…'; tierEl.textContent = '投掷中'; tierEl.className = 'tier tier-mid'; fbEl.textContent = '';
      let n = 0; const spin = setInterval(() => { dieEl.dataset.face = (Math.floor(Math.random() * 6) + 1); if (++n > 11) { clearInterval(spin); settle(); } }, 70);
    }
    function runPlayerClash() {
      phase = 'clash'; renderSide();
      playClash(() => {
        if (finished) { return; }
        const key = spec.order[idx], node = spec.nodes[key], opp = koOther(node, spec.playerKey);
        const out = koDecidePlayer(spec, key, lastRoll.r, null);
        koResolve(spec, key, out.win ? spec.playerKey : opp);
        let cause = out.reason || (out.win ? `${node.score} 拿下这一场。` : `${node.score} 惜败。`);
        if (lastRoll.tier <= 2 && out.win) cause = '尽管手感不在最佳状态，' + cause;
        node._cause = cause;
        phase = 'result'; renderSide(); renderBracket(); rafLinks();
        if (idx >= spec.order.length - 1) scheduleReport();
      });
    }
    function skipToPlayer() {
      clearTimers();
      while (true) {
        const key = spec.order[idx], node = spec.nodes[key];
        if (isPlayerMatch(key) && node.winner === null) { enterMatch(); return; }
        if (node.winner === null) { const w = koAutoWinner(node); if (w !== null) { koResolve(spec, key, w); node._cause = `${spec.teams[w].name} ${node.score} 晋级。`; } }
        if (idx >= spec.order.length - 1) { phase = 'result'; renderSide(); renderBracket(); rafLinks(); finish(); return; }
        idx++;
      }
    }
    function scheduleReport() { clearTimers(); autoTimer = setTimeout(finish, T(1000)); }

    /* --- 结束：真实结算 + 战报 + 颁奖 --- */
    function settleReal(place) {
      const money0 = P.money, pop0 = P.pop; let fmWon = false;
      if (place === 1) { const fm = E.checkFMVP(P, curYear, spec._fList); fmWon = fm.won; E.settleChamp(P, spec.kind, curYear, fmWon, E.placeMoney(spec.kind, 1)); if (fmWon) { spec._fmvpSpeech = E.fmvpSpeech(P, spec.kind, curYear); } }
      else if (place === 2) E.settleRunnerup(P, spec.kind, E.placeMoney(spec.kind, 2));
      else if (place === 3) E.settleThird(P, spec.kind, E.placeMoney(spec.kind, 3));
      else E.settlePlace(P, spec.kind, place);
      P.recent_perf = place === 1 ? 1.0 : (place === 2 ? 0.7 : (place === 3 ? 0.5 : 0.3));
      if (typeof renderHUD === 'function') renderHUD();
      spec._reward = { place, isChamp: place === 1, fmvp: fmWon, money: Math.round(P.money - money0), pop: +(P.pop - pop0).toFixed(1) };
      if (typeof pushLog === 'function') pushLog(`${spec.logTag}：${spec.placeLabel(place)}${fmWon ? ' + FMVP' : ''}。`, place <= 3 ? 'good' : '');
    }
    function finish() {
      if (settled) { openReport(); return; }
      settled = true; finished = true;
      koFinalize(spec);
      const place = koStandings(spec).indexOf(spec.playerKey) + 1;
      settleReal(place);
      renderBracket(); rafLinks(); openReport();
    }
    function openReport() {
      kq('repHero').innerHTML = koRepHeroHTML(spec);
      kq('repRank').innerHTML = koRepRankHTML(spec);
      kq('report').classList.add('show');
    }
    const RIBBON_COLORS = ['#f5cf6a', '#e2b53e', '#ffe2a0', '#cfa02b', '#a9781a'];
    function spawnRibbons() {
      const box = kq('cerRibbons'); box.innerHTML = '';
      for (let i = 0; i < 28; i++) {
        const r = document.createElement('span'); r.className = 'ribbon';
        r.style.left = (Math.random() * 100) + '%'; r.style.background = RIBBON_COLORS[i % RIBBON_COLORS.length];
        r.style.height = (11 + Math.random() * 12) + 'px';
        r.style.animationDuration = (1.6 + Math.random() * 1.4) + 's'; r.style.animationDelay = (Math.random() * 1.2) + 's';
        box.appendChild(r);
      }
    }
    function openCeremony() {
      const rw = spec._reward; if (!rw) return;
      const isChamp = rw.isChamp;
      kq('ceremony').classList.toggle('cer-plain', !isChamp);
      kq('cerLab').textContent = spec.header.cerTitlePrefix + (isChamp ? spec.header.champLab : spec.placeLabel(rw.place));
      kq('cerChamp').textContent = P.teamName;
      kq('cerMoneyLab').textContent = isChamp ? '冠军奖金' : '名次奖金';
      kq('cerMoney').textContent = rw.money.toLocaleString('en-US') + ' G';
      kq('cerFans').textContent = '+' + rw.pop.toFixed(1) + ' 万';
      if (isChamp) { kq('cerFmvp').innerHTML = rw.fmvp ? `<b>FMVP</b> ${P.name}` : `本场 FMVP 属于你的队友`; spawnRibbons(); }
      else kq('cerRibbons').innerHTML = '';
      // demov4.1feedback2·FMVP：夺冠且获 FMVP 时，颁奖界面提供「FMVP」按钮点开揭晓弹窗。
      const fb = kq('cerFmvpBtn');
      if (fb) { fb.style.display = (isChamp && rw.fmvp && spec._fmvpSpeech) ? 'flex' : 'none'; }
      kq('report').classList.remove('show'); kq('ceremony').classList.add('show');
    }

    /* --- 个人属性弹窗（运气为隐藏数值，仅占位不揭示，遵守对局全程不显示运气的规则） --- */
    function koStats() {
      // demov4.1feedback·季后赛个人属性：与常规赛一致——六维用「人气」替代「运气」（运气不显示）。
      return [
        { k: '技术', v: Math.round(P.tech) }, { k: '战术', v: Math.round(P.tac) }, { k: '体能', v: Math.round(P.phys) },
        { k: '稳定性', v: Math.round(P.stab) }, { k: '容貌', v: Math.round(P.appearance) }, { k: '人气', v: Math.round(P.pop), unit: '万' },
      ];
    }
    function radar(el, dims, size) {
      const R = size / 2 - 44, cx = size / 2, cy = size / 2 + 4, N = dims.length, NS = 'http://www.w3.org/2000/svg';
      const ang = (i) => (-90 + i * 360 / N) * Math.PI / 180, pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
      const poly = (vals) => vals.map((v, i) => pt(i, R * v / 100).join(',')).join(' ');
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', size); svg.setAttribute('height', size);
      let h = '';
      [.25, .5, .75, 1].forEach((f) => { h += `<polygon points="${dims.map((d, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,.07)"/>`; });
      dims.forEach((d, i) => { const [x, y] = pt(i, R); h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.06)"/>`; });
      h += `<polygon points="${poly(dims.map((d) => d.v))}" fill="rgba(232,93,154,.18)" stroke="#e85d9a" stroke-width="2"/>`;
      dims.forEach((d, i) => {
        const [px, py] = pt(i, R * d.v / 100); h += `<circle cx="${px}" cy="${py}" r="3" fill="#e85d9a"/>`;
        const [lx, ly] = pt(i, R + 22); const anc = Math.abs(lx - cx) < 8 ? 'middle' : (lx > cx ? 'start' : 'end');
        h += `<text x="${lx}" y="${ly - 2}" fill="#eef2f8" font-size="12" font-family="Sora" font-weight="600" text-anchor="${anc}">${d.k}</text>`;
        h += `<text x="${lx}" y="${ly + 13}" fill="#f5cf6a" font-size="13" font-family="'Chakra Petch'" font-weight="700" text-anchor="${anc}">${d.label != null ? d.label : d.v}</text>`;
      });
      svg.innerHTML = h; el.innerHTML = ''; el.appendChild(svg);
    }
    function buildStatBars() {
      kq('statBars').innerHTML = koStats().map((s) =>
        `<div class="stat"><span class="k">${s.k}</span><span class="track"><i style="width:${Math.min(100, s.v)}%"></i></span><span class="v mono">${s.v}${s.unit || ''}</span></div>`).join('');
    }

    /* --- 背包（demov4.0feedback·季后赛界面增加背包）：真实 P.inv + useItem，仅你的下一场开打前可用 --- */
    function koBagUsable() { return !finished && phase === 'ready' && isPlayerMatch(spec.order[idx]); }
    function koBagTotal() { return Object.values(P.inv || {}).reduce((s, n) => s + (n > 0 ? n : 0), 0); }
    function updateKoBagBadge() { const t = koBagTotal(), b = kq('bagBadge'); if (!b) return; b.textContent = t; b.style.display = t ? 'grid' : 'none'; }
    function renderKoBag() {
      updateKoBagBadge();
      const usable = koBagUsable();
      const tip = kq('bagTip'); if (tip) tip.textContent = usable ? '点击「使用」对你的下一场比赛生效' : '当前不可用 · 仅在你的下一场开打前可用道具';
      const items = Object.entries(P.inv || {}).filter(([, n]) => n > 0);
      kq('bagList').innerHTML = items.length
        ? items.map(([name, n]) => bagItemCardHTML(name, n, usable)).join('')
        : `<div class="bagx-empty">背包空 · 可在年度商店采购消耗品</div>`;
      kq('bagList').querySelectorAll('.bagx-use').forEach((b) => { b.onclick = () => koUseItem(b.dataset.n); });
    }
    function koUseItem(name) {
      if (!koBagUsable()) return;
      useItem(name);                 // 真实生效（含全局 flash + renderHUD）
      renderKoBag();
      // demov4.1feedback2·比赛界面：用药后体力 / 状态 tag（如清伤病移除腱鞘炎）立即在左侧面板刷新。
      const sp = kq('stamPanel'); if (sp) { sp.innerHTML = staminaPanelHtml(E.gameCost(spec.stageOf(spec.order[idx]))); }
    }
    kq('bagBtn').addEventListener('click', () => { renderKoBag(); kq('bag').classList.add('show'); });
    kq('bagX').addEventListener('click', () => kq('bag').classList.remove('show'));
    kq('bag').addEventListener('click', (e) => { if (e.target === kq('bag')) kq('bag').classList.remove('show'); });

    /* --- 事件绑定 --- */
    kq('actBtn').addEventListener('click', () => {
      const key = spec.order[idx];
      if (phase === 'ready' && isPlayerMatch(key)) doRoll();
      else if (phase === 'result') { if (idx >= spec.order.length - 1) openReport(); else autoAdvance(); }
    });
    kq('skipBtn').addEventListener('click', skipToPlayer);
    kq('ceremonyBtn').addEventListener('click', openCeremony);
    kq('cerFmvpBtn').addEventListener('click', () => { if (spec._fmvpSpeech) { openFmvpModal(spec._fmvpSpeech); } });
    kq('reportX').addEventListener('click', () => kq('report').classList.remove('show'));
    kq('report').addEventListener('click', (e) => { if (e.target === kq('report')) kq('report').classList.remove('show'); });
    kq('ceremonyX').addEventListener('click', () => kq('ceremony').classList.remove('show'));
    kq('ceremony').addEventListener('click', (e) => { if (e.target === kq('ceremony')) kq('ceremony').classList.remove('show'); });
    kq('attrBtn').addEventListener('click', () => {
      kq('modal').classList.add('show');
      radar(kq('radarBox'), koStats().map((s) => ({ k: s.k, v: Math.min(100, s.v), label: s.v + (s.unit || '') })), 280);
      buildStatBars();
      const mv = kq('moneyVal'); if (mv) { mv.textContent = Math.round(P.money).toLocaleString('en-US') + ' G'; }
    });
    kq('modalX').addEventListener('click', () => kq('modal').classList.remove('show'));
    kq('modal').addEventListener('click', (e) => { if (e.target === kq('modal')) kq('modal').classList.remove('show'); });
    function onKey(e) { if (e.key === 'Escape') { ['modal', 'report', 'ceremony', 'bag'].forEach((m) => kq(m) && kq(m).classList.remove('show')); } }
    document.addEventListener('keydown', onKey);

    function teardown() {
      clearTimers(); document.removeEventListener('keydown', onKey);
      closeFmvpModal();   // demov4.1feedback2：返回生涯时一并收起 FMVP 弹窗
      const el = document.getElementById('koscreen'); if (el) el.remove();
    }
    kq('cerDone').addEventListener('click', () => { teardown(); resolve({ place: spec._reward ? spec._reward.place : (koStandings(spec).indexOf(spec.playerKey) + 1), fList: spec._fList }); });

    /* --- 测试钩子：供 _uitest / _kotest 在不依赖动画时序时驱动整屏流程 --- */
    if (typeof window !== 'undefined') {
      window.__koScreen = {
        get phase() { return phase; }, get idx() { return idx; }, get finished() { return finished; },
        isPlayerMatch: () => isPlayerMatch(spec.order[idx]),
        clickAct: () => kq('actBtn').click(), skip: skipToPlayer,
        openCeremony, clickDone: () => kq('cerDone').click(), spec,
      };
    }

    /* --- 启动 --- */
    // demov4.1feedback2·体力：进入晋级图即按「比赛日体力回复」补满 MATCH_RECOVER(+40,封顶上限),
    // 在常规赛打完的残值基础上立刻生效并显示,而非打完首场才加。_lastDay 同步设为玩家首场比赛日,
    // 使 koDecidePlayer 不会在玩家首战时二次回复;后续比赛日仍按 dayFirst 正常回复。
    {
      const firstPlayerKey = spec.order.find((k) => isPlayerMatch(k)) || spec.order[0];
      P.stamina = E.matchStartStamina(P); P.fired_events = new Set();
      spec._lastDay = spec.nodes[firstPlayerKey].day;
      if (typeof renderHUD === 'function') { renderHUD(); }
    }
    enterMatch();
    raf(drawLinks);
    if (typeof window !== 'undefined') { window.addEventListener('resize', drawLinks); }
  });
}

