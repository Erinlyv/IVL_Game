/* =============================================================================
 * IVL 模拟器 · 交互编排 + UI (game.js)
 * 把已验证引擎(engine.js)的"自动决策"换成玩家点击，用 async/await 串起
 * 角色创建 → 7 赛年(训练/事件/商店/比赛) → 结局 的完整可玩切片。
 * ===========================================================================*/
const E = window.IVL;
const $ = (sel) => document.querySelector(sel);

let P = null;                 // 当前玩家
let curYear = 1, curAge = 18; // 当前赛年/年龄
let curStage = "—";           // 当前阶段(HUD 显示)
let logLines = [];            // 全局事件流水

/* ============================ UI 基础原语 ============================== */
const main = () => $("#main");

function setStage(s) { curStage = s; renderHUD(); }

// 通用呈现：返回 Promise，玩家点某个选项后 resolve 该选项 index
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
async function choose(title, body, choices, sub) {
  return present({ title, sub, body, choices });
}

function pushLog(text, cls = "") {
  logLines.unshift({ text, cls, t: `Y${curYear}` });
  if (logLines.length > 60) logLines.pop();
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
  if (!P) { h.innerHTML = ""; return; }
  const stMax = P.stamina_max;
  const stPct = Math.max(0, Math.min(100, (P.stamina / stMax) * 100));
  const stColor = P.stamina < 20 ? "#ff5c5c" : (P.stamina < 30 ? "#ffb454" : "#39d98a");
  const champs = `夏${P.champ["夏"]} 秋${P.champ["秋"]} IVS${P.champ["IVS"]} 深渊${P.champ["深渊"]}`;
  const debuffs = [];
  if (P.negative_news) debuffs.push(`<span class="db">负面新闻</span>`);
  if (P.teno_next) debuffs.push(`<span class="db">腱鞘炎</span>`);
  if (P.injury_this_tourney) debuffs.push(`<span class="db">伤病</span>`);
  if (P.has_wrist) debuffs.push(`<span class="db buff">护腕</span>`);
  if (P.nextGameBuff) debuffs.push(`<span class="db buff">下场F+${P.nextGameBuff.toFixed(0)}</span>`);

  h.innerHTML = `
    <div class="hud-id">
      <div class="avatar">${(P.name || "?").slice(0, 1)}</div>
      <div>
        <div class="pname">${P.name} <span class="pos">${P.position}${P.position === "监管者" ? "·屠皇" : ""}</span></div>
        <div class="pmeta">${P.identity} · ${curAge}岁 · 赛年 ${curYear}/7</div>
        <div class="pstage">阶段：${curStage}</div>
      </div>
    </div>

    <div class="stamina">
      <div class="stat-top"><span>体力</span><b>${P.stamina.toFixed(0)} / ${stMax.toFixed(0)}</b></div>
      <div class="track big"><i style="width:${stPct}%;background:${stColor}"></i></div>
    </div>

    <div class="stats">
      ${bar("技术", P.tech, "#5b9dff")}
      ${bar("战术", P.tac, "#a78bfa")}
      ${bar("体能", P.phys, "#39d98a")}
      ${bar("稳定", P.stab, "#ffd166")}
      ${bar("容貌", P.appearance, "#ff7eb6")}
    </div>

    <div class="res">
      <div class="resitem"><span>人气</span><b>${P.pop.toFixed(1)} 万</b></div>
      <div class="resitem"><span>资金</span><b>${P.money.toFixed(0)} G</b></div>
      <div class="resitem"><span>主力</span><b>${P.is_starter ? "✔ 首发" : "替补"}</b></div>
      <div class="resitem"><span>亚军</span><b>${P.runnerups}</b></div>
    </div>

    <div class="champs">🏆 ${champs} ｜ FMVP ${P.fmvp_total}</div>
    ${debuffs.length ? `<div class="debuffs">${debuffs.join("")}</div>` : ""}
    <div class="inv" id="inv"></div>`;
  renderInventory();
}

const INV_META = {
  "柠檬水": { tag: "stam", val: 30, label: "🥤体力+30" },
  "筋膜枪": { tag: "stam", val: 60, label: "🔫体力+60" },
  "好运签": { tag: "fbuff", val: 8, label: "🎴下场F+8" },
  "定制应援物料": { tag: "fbuff", val: 5, pop: 0.5, label: "📣下场F+5" },
  "战术分析仪": { tag: "fbuff", val: 6, label: "📊下场F+6" },
  "理疗康复套餐": { tag: "heal", label: "💊清伤病" },
};
function renderInventory() {
  const el = $("#inv");
  if (!el) return;
  const items = Object.entries(P.inv).filter(([, n]) => n > 0);
  if (!items.length) { el.innerHTML = `<div class="inv-empty">背包空（可在商店采购消耗品）</div>`; return; }
  el.innerHTML = `<div class="inv-title">背包（随时可用）</div>` +
    items.map(([name, n]) => {
      const m = INV_META[name];
      return `<button class="invbtn" data-item="${name}">${m.label} ×${n}</button>`;
    }).join("");
  el.querySelectorAll(".invbtn").forEach(b => {
    b.onclick = () => useItem(b.dataset.item);
  });
}
function useItem(name) {
  if (P.inv[name] <= 0) return;
  const m = INV_META[name];
  if (m.tag === "stam") {
    if (P.stamina >= P.stamina_max - 0.01) { flash("体力已满，无需补给"); return; }
    P.stamina = Math.min(P.stamina_max, P.stamina + m.val);
    flash(`使用${name}：体力 +${m.val}`);
  } else if (m.tag === "fbuff") {
    P.nextGameBuff += m.val;
    if (m.pop) P.addPop(m.pop);
    flash(`使用${name}：下一场 F +${m.val}${m.pop ? "、人气+" + m.pop : ""}`);
  } else if (m.tag === "heal") {
    if (!P.teno_next && !P.injury_this_tourney) { flash("当前没有伤病可清除"); return; }
    P.teno_next = false; P.injury_this_tourney = false;
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
const IDENTITIES = {
  "青训": { name: "青训选手", desc: "体能/技术/战术/稳定各 +3，更均衡；开局首个训练周期 5→7 次。" },
  "主播": { name: "人气主播", desc: "稳定 +3，资金 3000、人气 20；首赛年队内选拔阈值 −3。" },
  "人皇": { name: "榜前人皇／屠皇", desc: "技术 +12、战术 +5，操作天赋型，开局即战力。" },
};

async function characterCreation() {
  // 1) 输入 ID
  let name = "";
  await new Promise((resolve) => {
    main().innerHTML = `
      <div class="panel-head"><h2>创建角色 · 第 1 步</h2><p class="sub">输入你的选手 ID（将作为赛场显示名）</p></div>
      <div class="panel-body">
        <input id="nameInput" class="text-input" maxlength="12" placeholder="例如：屠皇、影、Knight…" />
      </div>
      <div class="choices"><button class="choice primary" id="nameOk"><span class="cl">下一步</span></button></div>`;
    const inp = $("#nameInput"); inp.focus();
    const go = () => { name = (inp.value || "无名选手").trim() || "无名选手"; resolve(); };
    $("#nameOk").onclick = go;
    inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });

  // 2) 选身份
  const idKey = ["青训", "主播", "人皇"][await choose(
    "创建角色 · 第 2 步",
    `<p>选择初始身份，将决定开局裸值与若干特殊扶持。</p>`,
    Object.keys(IDENTITIES).map(k => ({ label: IDENTITIES[k].name, hint: IDENTITIES[k].desc }))
  )];

  // 3) 选定位
  const posIdx = await choose(
    "创建角色 · 第 3 步",
    `<p>选择定位。<b>仅影响身份扮演与称号文案，不影响任何胜负判定。</b></p>`,
    [
      { label: "求生者", hint: "灵动走位、绕桩大师的浪漫" },
      { label: "监管者", hint: "压迫感拉满，达成称号「屠皇」" },
    ]
  );
  const position = posIdx === 0 ? "求生者" : "监管者";

  // 4) 生成数值 + 无限刷新
  let temp = new E.Player(idKey, name, position);
  while (true) {
    const idx = await present({
      title: "创建角色 · 第 4 步",
      sub: "随机生成属性，不满意可无限刷新。容貌与运气全程固定。",
      body: rollCardHtml(temp),
      choices: [
        { label: "🎲 重新随机", hint: "再赌一把" },
        { label: "✓ 确定，开启职业生涯", cls: "primary", hint: "锁定属性" },
      ],
    });
    if (idx === 0) { temp = new E.Player(idKey, name, position); continue; }
    break;
  }
  P = temp;
  curYear = 1; curAge = 18;
  renderHUD();
  await say("出道", `
    <p>${P.name}，${IDENTITIES[idKey].name}，定位${position}${position === "监管者" ? "·屠皇" : ""}。</p>
    <p>你以<b>替补</b>身份进入俱乐部青训体系，前方是 7 个赛年（18→24 岁）的职业生涯。</p>
    <p>是否能从饮水机管理员熬成时代丰碑，全看接下来每一个选择。</p>`, "开始第 1 赛年");
  pushLog(`${P.name} 出道，定位${position}。`, "good");
}

function rollCardHtml(t) {
  const row = (k, v, c) => `<div class="rollrow"><span>${k}</span><div class="rolltrack"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div><b>${v.toFixed(0)}</b></div>`;
  return `<div class="rollcard">
    ${row("技术", t.tech, "#5b9dff")}
    ${row("战术", t.tac, "#a78bfa")}
    ${row("体能", t.phys, "#39d98a")}
    ${row("稳定", t.stab, "#ffd166")}
    ${row("容貌", t.appearance, "#ff7eb6")}
    <div class="rollrow muted"><span>运气</span><div class="rolltrack"><i style="width:0%"></i></div><b>?? 隐藏</b></div>
    <div class="rollmeta">资金 ${t.money.toFixed(0)} G · 人气 ${t.pop.toFixed(0)} 万 · 体力上限 ${t.stamina_max.toFixed(0)}</div>
  </div>`;
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

function trainingTurn(turn, total) {
  return new Promise((resolve) => {
    const stMax = P.stamina_max;
    const projHtml = Object.keys(E.CONFIG.TRAIN).map(proj => {
      const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[curIntensity][1];
      const need = proj !== "休息" && P.stamina < cost;
      return `<button class="trainproj ${need ? "disabled" : ""}" data-proj="${proj}" ${need ? "disabled" : ""}>
        <span class="tp-name">${proj}</span>
        <span class="tp-info">${TRAIN_INFO[proj]}</span>
        ${need ? `<span class="tp-need">体力不足</span>` : ""}
      </button>`;
    }).join("");
    main().innerHTML = `
      <div class="panel-head"><h2>训练 · 第 ${turn}/${total} 次</h2>
        <p class="sub">选择强度与项目。每次训练有约 35% 概率触发突发事件。</p></div>
      <div class="panel-body">
        <div class="intensity">
          强度：
          ${["休养", "正常", "高强度"].map(i => `<button class="intbtn ${i === curIntensity ? "on" : ""}" data-int="${i}">${i}</button>`).join("")}
          <span class="int-hint">效果/消耗 ×${E.CONFIG.INTENSITY[curIntensity][0]}</span>
        </div>
        <div class="trainprojs">${projHtml}</div>
      </div>`;
    main().querySelectorAll(".intbtn").forEach(b => {
      b.onclick = () => { curIntensity = b.dataset.int; trainingTurnRerender(turn, total, resolve); };
    });
    bindProj(resolve);
  });
}
function trainingTurnRerender(turn, total, resolve) {
  // 重新渲染当前训练界面以反映强度变化
  const stMax = P.stamina_max;
  const projHtml = Object.keys(E.CONFIG.TRAIN).map(proj => {
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[curIntensity][1];
    const need = proj !== "休息" && P.stamina < cost;
    return `<button class="trainproj ${need ? "disabled" : ""}" data-proj="${proj}" ${need ? "disabled" : ""}>
      <span class="tp-name">${proj}</span><span class="tp-info">${TRAIN_INFO[proj]}</span>
      ${need ? `<span class="tp-need">体力不足</span>` : ""}</button>`;
  }).join("");
  const pb = main().querySelector(".panel-body");
  pb.innerHTML = `
    <div class="intensity">强度：
      ${["休养", "正常", "高强度"].map(i => `<button class="intbtn ${i === curIntensity ? "on" : ""}" data-int="${i}">${i}</button>`).join("")}
      <span class="int-hint">效果/消耗 ×${E.CONFIG.INTENSITY[curIntensity][0]}</span></div>
    <div class="trainprojs">${projHtml}</div>`;
  pb.querySelectorAll(".intbtn").forEach(b => {
    b.onclick = () => { curIntensity = b.dataset.int; trainingTurnRerender(turn, total, resolve); };
  });
  bindProj(resolve);
}
function bindProj(resolve) {
  main().querySelectorAll(".trainproj:not(.disabled)").forEach(b => {
    b.onclick = () => resolve({ proj: b.dataset.proj, intensity: curIntensity });
  });
}

async function trainingPeriod(n, periodLabel) {
  setStage(periodLabel);
  P.stamina = P.stamina_max;            // 周期开始体力回满
  const tenoP = 0.05 + (curAge - 18) * 0.015;
  for (let i = 1; i <= n; i++) {
    const before = snapshotAttrs();
    let { proj, intensity } = await trainingTurn(i, n);
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[intensity][1];
    if (proj !== "休息" && P.stamina < cost) { proj = "休息"; intensity = "正常"; }
    E.applyTraining(P, proj, intensity, curYear);
    renderHUD();
    if (proj === "休息") { pushLog(`训练${i}：休息，体力回复。`); continue; }
    const dlt = diffAttrs(before);
    pushLog(`训练${i}：${proj}（${intensity}）${dlt}`);

    // 每次训练 ≤1 次事件：先判腱鞘炎，否则判通用事件
    if (Math.random() < tenoP) {
      P.phys = Math.max(0, P.phys - 4); P.teno_next = true; renderHUD();
      await say("⚠ 受伤·腱鞘炎", `<p>长时间高强度操作，你的手腕发出抗议。</p><p>体能 −4，下一场比赛 F −12。可用「理疗康复套餐」清除。</p>`, "忍痛继续");
      pushLog(`训练${i}后：腱鞘炎！体能−4，下场F−12。`, "bad");
    } else if (Math.random() < E.CONFIG.TRAIN_EVENT_P) {
      await trainingEvent();
    }
    renderHUD();
  }
}

async function trainingEvent() {
  const key = E.TRAIN_EVENT_KEYS[Math.floor(Math.random() * E.TRAIN_EVENT_KEYS.length)];
  const ev = E.TRAIN_EVENTS[key];
  const idx = await choose(`突发事件 · ${key}`, `<p class="flavor">${ev.flavor}</p>`,
    ev.options.map(o => ({ label: o.label, hint: o.hint })));
  const before = snapshotAttrs();
  const result = ev.options[idx].apply(P);
  P._clamp(); renderHUD();
  if (P._fired) { throw { forced: "你被开除了！" }; }
  pushLog(`${key}：${ev.options[idx].label}`, key === "私联粉丝" ? "bad" : "");
  await say(`事件结果 · ${key}`, `<p>${result}</p>`, "继续");
}

/* ============================== 商店 ================================== */
async function shopPhase() {
  setStage("年度商店");
  P.has_wrist = false;
  P.negative_news = false;     // 负面新闻按"时间"在新赛年清除
  // 每年商店库存
  const stock = E.SHOP_ITEMS.map(it => ({ ...it, left: it.qty }));
  await new Promise((resolve) => {
    const render = () => {
      const rows = stock.map((it, i) => {
        const afford = P.money >= it.price && it.left > 0;
        const sold = it.left <= 0;
        return `<div class="shoprow ${sold ? "sold" : ""}">
          <div class="si-name">${it.name}<span class="si-desc">${it.desc}</span></div>
          <div class="si-price">${it.price}G</div>
          <div class="si-left">×${it.left}</div>
          <button class="si-buy" data-i="${i}" ${afford ? "" : "disabled"}>${sold ? "售罄" : "购买"}</button>
        </div>`;
      }).join("");
      main().innerHTML = `
        <div class="panel-head"><h2>赛年 ${curYear} · 年度商店</h2>
          <p class="sub">资金 <b>${P.money.toFixed(0)} G</b>。属性类道具立即生效且不受年龄衰减；消耗品进背包随时使用。</p></div>
        <div class="panel-body"><div class="shop">${rows}</div></div>
        <div class="choices"><button class="choice primary" id="shopDone"><span class="cl">采购完毕，进入训练</span></button></div>`;
      main().querySelectorAll(".si-buy:not([disabled])").forEach(b => {
        b.onclick = () => buy(stock[+b.dataset.i], render);
      });
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
  } else if (it.kind === "wrist") {
    P.has_wrist = true; flash("购买护腕：本年受伤概率 ×0.4");
  } else if (it.kind === "clear") {
    P.negative_news = false; flash("公关出手：负面新闻已清除");
  } else if (it.kind === "consume") {
    P.inv[it.name] = (P.inv[it.name] || 0) + 1; flash(`购入${it.name}，已进背包`);
  }
  renderHUD(); render();
  pushLog(`商店购买：${it.name}（−${it.price}G）`);
}

/* ============================== 比赛 ================================== */
// 打一场，处理交互式事件，返回 {win, F, line}
async function playGame(stage, oppPopBase, winPop) {
  P.stamina -= 10;
  const fainted = P.stamina <= 0;
  const injuredBefore = P.injury_this_tourney;
  renderHUD();

  const cp = P.cp;
  const luckOff = (P.luck - 50) * 0.10;
  const V = 20 - P.stab * 0.15;
  const rfloat = E.rnd(-V, V);
  const diff = P.pop - oppPopBase;
  const cheer = diff >= 80 ? 5 : (diff >= 30 ? 3 : 0);

  let fdelta = 0;
  let eventNarr = null;
  const ev = E.rollMatchEvent(P);
  if (ev.needChoice) {
    const idx = await choose(`赛中事件 · ${ev.key}`, `<p class="flavor">${ev.flavor}</p>`,
      ev.options.map(o => ({ label: o.label, hint: o.hint })));
    const opt = ev.options[idx];
    if (ev.custom) {
      const r = opt.apply(P);
      fdelta = r.f; eventNarr = r.txt;
    } else {
      eventNarr = opt.apply(P);
      fdelta = opt.fdelta || 0;
    }
    renderHUD();
  } else {
    fdelta = ev.fdelta || 0;
    eventNarr = ev.log;
  }

  const buff = P.nextGameBuff; P.nextGameBuff = 0;   // 道具临时 buff 消耗
  let inner = cp + luckOff + rfloat + cheer + fdelta + buff;
  if (P.teno_next) { inner -= 12; P.teno_next = false; }
  if (injuredBefore) inner -= 8;
  if (P.stamina < 20) inner -= 15;
  if (P.negative_news) inner *= 0.90;
  const F = Math.max(0, Math.min(100, inner));

  const team = 0.8 * F + 0.2 * E.npcSelf(curYear);
  const opp = E.sampleOpp(stage, curYear);
  const win = (!fainted) && (team > opp);

  if (win) { P.addPop(winPop); P.money += 100; }
  else if (Math.random() < 0.30) P.pop = Math.max(0, P.pop - 0.1);
  renderHUD();

  let line = `${win ? "✔ 胜" : "✘ 负"}　你 ${F.toFixed(0)}（队 ${team.toFixed(0)}）vs 对手 ${opp.toFixed(0)}`;
  if (fainted) line = `✘ 体力清零·晕倒判负　对手 ${opp.toFixed(0)}`;
  return { win, F, line, eventNarr, fainted };
}

// 常规赛：9 场，批量呈现日志(交互事件期间会暂停)；返回 {rank, inPlayoff}
async function regularSeason(kind) {
  setStage(`${kind}季赛·常规赛`);
  P.injury_this_tourney = false;
  P.stamina = P.stamina_max;
  const lines = []; let wins = 0;
  for (let g = 1; g <= 9; g++) {
    const r = await playGame("常规", E.OPP_POP["常规"], E.WIN_POP["常规"]);
    if (ev_narr_should_log(r)) {/* narrative already shown via choose */ }
    if (r.win) wins++;
    lines.push(`<div class="gline ${r.win ? "w" : "l"}">第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
  }
  const others = []; for (let i = 0; i < 9; i++) { let w = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) w++; others.push(w); }
  const better = others.filter(w => w > wins).length;
  const ties = others.filter(w => w === wins).length;
  const rank = 1 + better + E.randint(0, ties);
  const inPlayoff = rank <= 6;
  pushLog(`${kind}季赛常规赛：${wins}胜，名次第 ${rank}，${inPlayoff ? "晋级季后赛" : "无缘季后赛"}。`, inPlayoff ? "good" : "bad");
  await say(`${kind}季赛 · 常规赛战报`, `
    <div class="gamelog">${lines.join("")}</div>
    <p class="summary">常规赛 <b>${wins} 胜 ${9 - wins} 负</b>，最终排名 <b>第 ${rank} 名</b>（前 6 进季后赛）。</p>
    <p class="${inPlayoff ? "ok" : "ko"}">${inPlayoff ? "🎉 晋级季后赛！" : "😔 遗憾止步常规赛。"}</p>`,
    inPlayoff ? "进入季后赛" : "继续");
  return { rank, inPlayoff };
}

// 3 场淘汰：全胜=冠军，赢2输=亚军…逐场呈现。返回 {champ, runner, place, fList}
async function knockout3(stage, oppPopBase, winPop, label) {
  setStage(label);
  P.stamina = P.stamina_max;
  let wins = 0; const fList = []; const names = ["1/4 决赛", "半决赛", "决赛"];
  for (let g = 0; g < 3; g++) {
    await say(`${label} · ${names[g]}`, `<p>第 ${g + 1} 场即将开始。可在右侧背包使用道具补给体力或叠加 F buff。</p>
      <p class="muted">当前体力 ${P.stamina.toFixed(0)} / ${P.stamina_max.toFixed(0)}${P.nextGameBuff ? `，预备 F buff +${P.nextGameBuff.toFixed(0)}` : ""}</p>`, "开打");
    const r = await playGame(stage, oppPopBase, winPop);
    fList.push(r.F);
    pushLog(`${label}·${names[g]}：${r.line.replace(/<[^>]+>/g, "")}`, r.win ? "good" : "bad");
    await say(`${label} · ${names[g]} 结果`, `
      <div class="gline ${r.win ? "w" : "l"} big">${r.line}</div>
      ${r.eventNarr ? `<p class="gev2">${r.eventNarr}</p>` : ""}`, r.win ? "继续" : "接受结果");
    if (r.win) wins++; else break;
  }
  let champ = false, runner = false, place;
  if (wins === 3) { champ = true; place = 1; }
  else if (wins === 2) { runner = true; place = 2; }
  else if (wins === 1) place = 4;
  else place = 6;
  return { champ, runner, place, fList };
}

function ev_narr_should_log() { return false; }

// 夏/秋季赛：常规 → 季后。返回季后名次(无缘=8)
async function playDomestic(kind) {
  P.injury_this_tourney = false;
  const { rank, inPlayoff } = await regularSeason(kind);
  if (!inPlayoff) return 8;
  const r = await knockout3("季后", E.OPP_POP["季后"], E.WIN_POP["季后"], `${kind}季赛·季后赛`);
  await settleResult(kind, r, kind);
  return r.place;
}

async function playIVS() {
  setStage("洲际邀请赛 IVS");
  P.injury_this_tourney = false;
  await say("洲际邀请赛 IVS", `<p>你随队代表赛区出征 IVS！这里云集跨赛区精英，对手强度陡增（[70,84]）。</p>`, "出征");
  const r = await knockout3("IVS", E.OPP_POP["IVS"], E.WIN_POP["IVS"], "IVS");
  await settleResult("IVS", r, "IVS");
}

async function playAbyss(seeded) {
  setStage("深渊的呼唤");
  P.injury_this_tourney = false;
  await say("深渊的呼唤 · 全球赛", `
    <p>一年一度的全球总决赛「深渊的呼唤」开幕。</p>
    <p>${seeded ? "凭借国内季后赛的出色表现，你被<b>保送小组赛</b>，跳过预选！" : "你需要先从预选赛打起（2 场，胜 ≥1 进小组）。"}</p>`, "进入深渊");

  if (!seeded) {
    setStage("深渊·预选赛");
    P.stamina = P.stamina_max;
    let w = 0; const lines = [];
    for (let g = 1; g <= 2; g++) {
      const r = await playGame("预选", E.OPP_POP["深渊"], E.WIN_POP["预选"]);
      if (r.win) w++;
      lines.push(`<div class="gline ${r.win ? "w" : "l"}">预选第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
    }
    await say("深渊 · 预选赛战报", `<div class="gamelog">${lines.join("")}</div><p class="summary">预选 ${w} 胜（需 ≥1 进小组）。</p>`, "继续");
    if (w < 1) { pushLog("深渊预选出局。", "bad"); await say("深渊 · 止步预选", `<p>预选赛未能取胜，今年的深渊之旅到此为止。</p>`, "继续"); return; }
  }

  // 小组赛 3 场，胜 ≥2 进总决
  setStage("深渊·小组赛");
  P.stamina = P.stamina_max;
  let wg = 0; const glines = [];
  for (let g = 1; g <= 3; g++) {
    const r = await playGame("小组", E.OPP_POP["深渊"], E.WIN_POP["小组"]);
    if (r.win) wg++;
    glines.push(`<div class="gline ${r.win ? "w" : "l"}">小组第${g}场　${r.line}${r.eventNarr ? `<span class="gev">· ${r.eventNarr}</span>` : ""}</div>`);
  }
  await say("深渊 · 小组赛战报", `<div class="gamelog">${glines.join("")}</div><p class="summary">小组 ${wg} 胜（需 ≥2 进总决赛）。</p>`,
    wg >= 2 ? "挺进总决赛" : "继续");
  if (wg < 2) { pushLog("深渊小组赛出局。", "bad"); await say("深渊 · 止步小组", `<p>小组赛功亏一篑，无缘总决赛。</p>`, "继续"); return; }

  // 总决赛 3 场淘汰
  const r = await knockout3("总决", E.OPP_POP["深渊"], E.WIN_POP["总决"], "深渊·总决赛");
  await settleResult("深渊", r, "深渊");
}

// 统一结算冠/亚军 + FMVP + 文案
async function settleResult(kind, r, fmvpKindLabel) {
  const champKey = kind;   // 夏/秋/IVS/深渊
  if (r.champ) {
    const fm = E.checkFMVP(P, curYear, r.fList);
    E.settleChamp(P, champKey, fm.won);
    const [popR, moneyR] = E.CONFIG.CHAMP_REWARD[champKey];
    let body = `<p class="champ-banner">🏆 ${titleOf(kind)}冠军！</p>
      <p>奖励：人气 +${popR}（×外貌系数 ${P.pop_mult.toFixed(2)}）、资金 +${moneyR}G。</p>`;
    if (fm.won) {
      body += `<p class="fmvp">⭐ 你当选 FMVP！场均 F ${fm.avg.toFixed(1)}，额外 人气+20、资金+1500。</p>`;
      pushLog(`${titleOf(kind)}夺冠 + FMVP！`, "good");
    } else {
      let why = "";
      if (fm.reason === "low") why = `场均 F ${fm.avg.toFixed(1)} 未达 90 门槛`;
      else if (fm.reason === "mate") why = `场均 ${fm.avg.toFixed(1)} 未压过所有队友`;
      else why = `通过资格，但 FMVP 投票惜败（中选率 ${(fm.p * 100).toFixed(0)}%）`;
      body += `<p class="muted">关于 FMVP：${why}。<b>冠军不等于 FMVP</b>——奖杯属于全队，MVP 仍需更硬的个人数据与一点运气。</p>`;
      pushLog(`${titleOf(kind)}夺冠（无 FMVP）。`, "good");
    }
    await say(`${titleOf(kind)} · 夺冠！`, body, "登顶时刻");
  } else if (r.runner) {
    E.settleRunnerup(P, champKey);
    pushLog(`${titleOf(kind)}亚军。`, "");
    await say(`${titleOf(kind)} · 亚军`, `
      <p>决赛惜败，屈居亚军。人气 +8（×外貌系数）、资金 +${(E.CONFIG.CHAMP_REWARD[champKey][1] / 3).toFixed(0)}G。</p>
      <p class="muted">差一步登顶。零冠却年年亚军的高颜值选手，也能靠流量走出另一条路。</p>`, "继续");
  } else {
    pushLog(`${titleOf(kind)}止步（第 ${r.place} 名）。`, "");
    await say(`${titleOf(kind)} · 出局`, `<p>本届${titleOf(kind)}止步于第 ${r.place} 名。胜场涨粉已计入。</p>`, "继续");
  }
}
function titleOf(kind) { return kind === "IVS" ? "IVS" : (kind === "深渊" ? "深渊（全球赛）" : kind + "季赛"); }

/* ============================ 队内选拔 ================================ */
async function selection(eventLabel) {
  if (P.is_starter) return true;
  setStage(`${eventLabel}·队内选拔`);
  // 5% 缺人直接首发
  if (Math.random() < E.CONFIG.SELECT_VACANCY_P) {
    P.is_starter = true; P.ever_starter = true; P.consec_fail = 0; renderHUD();
    pushLog(`${eventLabel}：队内缺人，直接首发转正！`, "good");
    await say(`${eventLabel} · 队内选拔`, `<p>队内临时缺人，教练直接把你推上首发——<b>转正主力！</b></p>`, "上场");
    return true;
  }
  const score = P.cp + (P.luck - 50) * 0.1;
  let thr = E.selectThreshold(curYear);
  if (P.identity === "主播" && curYear === 1) thr -= 3;
  const pass = score >= thr;
  if (pass) {
    P.is_starter = true; P.ever_starter = true; P.consec_fail = 0; renderHUD();
    pushLog(`${eventLabel}：选拔通过，转正主力！`, "good");
    await say(`${eventLabel} · 队内选拔`, `<p>选拔评分 <b>${score.toFixed(1)}</b> ≥ 阈值 ${thr.toFixed(1)}。</p><p>你击败竞争者，<b>转正主力！</b>此后免选拔。</p>`, "上场");
    return true;
  }
  // 未通过
  P.consec_fail += 1;
  if (curYear === 1) P.first_year_failed = true;
  renderHUD();
  pushLog(`${eventLabel}：选拔失败（连续 ${P.consec_fail} 次），观赛。`, "bad");
  if (P.consec_fail >= 3) throw { forced: "饮水机管理员" };
  await say(`${eventLabel} · 队内选拔`, `
    <p>选拔评分 <b>${score.toFixed(1)}</b> < 阈值 ${thr.toFixed(1)}，本赛事坐板凳观赛。</p>
    <p class="${P.consec_fail >= 2 ? "ko" : "muted"}">连续未通过：${P.consec_fail}/3（满 3 次将被强制结局「饮水机管理员」）。${curYear === 1 ? "（首年失败已记入「光荣的荆棘路」前置）" : ""}</p>`, "继续");
  return false;
}

/* ========================= 半途特殊结局(二选一) ======================= */
const SPECIAL_HINT = {
  "签约艺人": "你颜值与流量俱佳但缺乏赛场硬实力，经纪公司向你伸出橄榄枝。",
  "短剧演员": "外形 + 艺能爆表，娱乐圈短剧片约找上门来。",
  "转行解说": "你嘴比手快、战术理解超群，解说席向你招手。",
  "转行教练": "国内有冠却未登顶世界，你已是名帅候选——但世界冠军会改变你的轨迹。",
  "校长好": "资历、财力、人气兼备，你可以开办自己的电竞学校。",
};
async function offerSpecial(name) {
  P.offered.add(name);
  const idx = await choose(`人生岔路 · ${name}`, `
    <p class="flavor">${SPECIAL_HINT[name]}</p>
    <p>${E.ENDING_TEXT[name]}</p>`,
    [
      { label: "我还是更喜欢赛场", hint: "继续职业生涯（本周目不再提示）", cls: "" },
      { label: `接受 →【达成结局·${name}】`, hint: "就此退役，开启新身份", cls: "primary" },
    ]);
  return idx === 1;   // true=接受结局
}

/* ============================== 主流程 ================================ */
function snapshotAttrs() { return { tech: P.tech, tac: P.tac, phys: P.phys, stab: P.stab, pop: P.pop, money: P.money }; }
function diffAttrs(b) {
  const parts = [];
  const map = { tech: "技", tac: "战", phys: "体", stab: "稳" };
  for (const k of ["tech", "tac", "phys", "stab"]) { const d = P[k] - b[k]; if (Math.abs(d) > 0.05) parts.push(`${map[k]}${d > 0 ? "+" : ""}${d.toFixed(1)}`); }
  const dp = P.pop - b.pop; if (Math.abs(dp) > 0.01) parts.push(`人气${dp > 0 ? "+" : ""}${dp.toFixed(1)}`);
  return parts.length ? "→ " + parts.join(" ") : "";
}

function champSnapshot() { return { ...P.champ }; }

async function career() {
  let grandSlam = false;
  let forced = null;
  try {
    for (curYear = 1; curYear <= E.CONFIG.YEARS; curYear++) {
      curAge = E.CONFIG.START_AGE + (curYear - 1);
      renderHUD();
      await yearIntro();
      await shopPhase();

      const yc = new Set();
      let summerRank = 8, autumnRank = 8;

      // 训练①
      const n1 = (P.identity === "青训" && curYear === 1) ? 7 : 5;
      await trainingPeriod(n1, "训练① · 季前");

      // 夏季赛
      if (await selection("夏季赛")) {
        const c0 = champSnapshot();
        summerRank = await playDomestic("夏");
        if (P.champ["夏"] > c0["夏"]) yc.add("夏");
      }

      // IVS（夏季赛前 2 且 已上场）
      if (summerRank <= 2 && P.is_starter) {
        const c0 = champSnapshot();
        await playIVS();
        if (P.champ["IVS"] > c0["IVS"]) yc.add("IVS");
      }

      // 训练②
      await trainingPeriod(5, "训练② · 夏秋之间");

      // 秋季赛
      if (await selection("秋季赛")) {
        const c0 = champSnapshot();
        autumnRank = await playDomestic("秋");
        if (P.champ["秋"] > c0["秋"]) yc.add("秋");
      }

      // 训练③
      await trainingPeriod(5, "训练③ · 深渊前");

      // 深渊（必参）
      if (await selection("深渊")) {
        const seeded = (summerRank + autumnRank) / 2 <= 2.0;
        const c0 = champSnapshot();
        await playAbyss(seeded);
        if (P.champ["深渊"] > c0["深渊"]) yc.add("深渊");
      }

      // 金满贯
      if (["夏", "秋", "IVS", "深渊"].every(k => yc.has(k))) grandSlam = true;

      // 赛年结算
      await yearSettle();

      // 半途特殊结局(二选一)
      const trigs = E.specialTriggers(P, curYear);
      for (const name of trigs) {
        if (P.offered.has(name)) continue;
        const accept = await offerSpecial(name);
        if (accept) { forced = name; throw { forced: name, special: true }; }
      }
    }
  } catch (e) {
    if (e && e.forced) forced = e.forced;
    else throw e;
  }
  await ending(grandSlam, forced);
}

async function yearIntro() {
  setStage("赛年开始");
  if (curYear === 1) return;
  await say(`赛年 ${curYear}（${curAge} 岁）`, `
    <p>新的一年开始了。商店已刷新，负面新闻随时间消散。</p>
    ${curYear >= 4 ? `<p class="muted">已进入成长衰减期：技术/体能成长 ×${E.growthTech(curYear).toFixed(2)}，战术 ×${E.growthTac(curYear).toFixed(2)}。靠道具/事件补满属性更重要。</p>` : ""}`, "进入商店");
}

async function yearSettle() {
  setStage("赛年结算");
  const a = `技${P.tech.toFixed(0)} 战${P.tac.toFixed(0)} 体${P.phys.toFixed(0)} 稳${P.stab.toFixed(0)}`;
  await say(`赛年 ${curYear} 结算`, `
    <p>本赛年结束。当前面板：${a} · 容貌${P.appearance.toFixed(0)}。</p>
    <p>人气 <b>${P.pop.toFixed(1)} 万</b>，资金 <b>${P.money.toFixed(0)} G</b>，冠军 ${P.totalChamp} 座，FMVP ${P.fmvp_total} 次，亚军 ${P.runnerups} 次。</p>
    ${curYear < 7 ? "" : `<p class="ok">7 个赛年走到了尽头……</p>`}`, curYear < 7 ? `进入赛年 ${curYear + 1}` : "迎接结局");
}

/* ============================== 结局 ================================== */
async function ending(grandSlam, forced) {
  setStage("生涯落幕");
  const finalName = E.finalEnding(P, grandSlam, forced);
  const ach = E.computeAchievements(P, grandSlam);
  const isForced = forced === "饮水机管理员" || forced === "你被开除了！";
  const isSpecial = forced && !isForced;

  pushLog(`生涯结束：${finalName}`, "good");

  const achHtml = ach.length
    ? ach.map(a => `<div class="ach"><b>${a}</b><span>${E.ACH_DESC[a] || ""}</span></div>`).join("")
    : `<div class="ach muted">本周目未解锁成就。</div>`;

  const champLine = `夏 ${P.champ["夏"]}　秋 ${P.champ["秋"]}　IVS ${P.champ["IVS"]}　深渊 ${P.champ["深渊"]}　｜　亚军 ${P.runnerups}　FMVP ${P.fmvp_total}`;

  await present({
    title: `结局 · ${finalName}`,
    sub: isForced ? "强制结局" : (isSpecial ? "你主动接受了人生岔路" : "满 7 赛年 · 最终结局"),
    body: `
      <div class="ending ${isForced ? "bad" : "good"}">
        <div class="ending-name">${finalName}</div>
        <p class="ending-text">${E.ENDING_TEXT[finalName] || ""}</p>
      </div>
      <h3 class="rv">生涯回顾 · ${P.name}（${P.identity}·${P.position}）</h3>
      <div class="review">
        <div class="rv-attrs">
          ${rvBar("技术", P.tech, "#5b9dff")}${rvBar("战术", P.tac, "#a78bfa")}
          ${rvBar("体能", P.phys, "#39d98a")}${rvBar("稳定", P.stab, "#ffd166")}
          ${rvBar("容貌", P.appearance, "#ff7eb6")}
        </div>
        <div class="rv-res">
          <span>人气 <b>${P.pop.toFixed(1)} 万</b></span>
          <span>资金 <b>${P.money.toFixed(0)} G</b></span>
          <span>运气(揭晓) <b>${P.luck.toFixed(0)}</b></span>
        </div>
        <div class="rv-champ">🏆 ${champLine}</div>
      </div>
      <h3 class="rv">解锁成就（${ach.length}）</h3>
      <div class="achs">${achHtml}</div>`,
    choices: [{ label: "🔄 再来一局", cls: "primary" }],
  });
  // 重开
  logLines = []; P = null; renderHUD();
  await boot();
}
function rvBar(k, v, c) { return `<div class="rvbar"><span>${k}</span><div class="rvtrack"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div><b>${v.toFixed(0)}</b></div>`; }

/* ============================== 启动 ================================== */
async function boot() {
  await say("IVL 模拟器 · 可玩切片 v1.2", `
    <p>欢迎来到《IVL 模拟器》。你将扮演一名《第五人格》职业电竞选手，从青训出道，征战 7 个赛年。</p>
    <ul class="intro">
      <li><b>训练养成</b>：选项目与强度，提升技术/战术/体能/稳定。</li>
      <li><b>突发事件</b>：抉择影响数值、人气与剧情走向（含高风险陷阱）。</li>
      <li><b>赛事模拟</b>：夏季赛 / IVS / 秋季赛 / 深渊全球赛，逐场结算与夺冠。</li>
      <li><b>结局分支</b>：从「饮水机管理员」到「时代丰碑」，由你的每个选择书写。</li>
    </ul>
    <p class="muted">本切片用于验证手感 / 文案 / UI，数值与已验证的蒙特卡洛引擎同源。</p>`, "创建角色");
  await characterCreation();
  await career();
}

window.addEventListener("DOMContentLoaded", () => { renderHUD(); boot(); });
