/* 冲烟测试 / 头脑风暴式回归 (v2.3)：用 JS 引擎(engine.js)自动重跑若干档位，
 * 验证第二版切片的引擎移植没有崩溃、且夺冠率与《回归报告v2.3》同量级。
 * 自动策略：突发事件统一选 0 号选项(私联粉丝选婉拒)；赛中事件选 0 号选项。
 * 仅供开发期使用，可删。运行： node _smoketest.js 8000
 */
global.window = global;
require("./engine.js");
const E = global.IVL;

function autoTrainPeriod(p, n, year, age, attrs, intensity, attendPop) {
  p.stamina = p.stamina_max; p.inj_train_mult = 1.0;
  let trained = false;
  for (let i = 0; i < n; i++) {
    let proj = attrs.reduce((a, b) => (p[a[1]] <= p[b[1]] ? a : b))[0];
    let it = intensity;
    const cost = E.CONFIG.TRAIN[proj].cost * E.CONFIG.INTENSITY[it][1];
    if (p.stamina < cost) { proj = "休息"; it = "正常"; }
    E.applyTraining(p, proj, it, year);
    if (proj === "休息") continue;
    trained = true;
    if (Math.random() < E.CONFIG.TRAIN_EVENT_P) {
      const k = E.choiceOf(E.TRAIN_EVENT_KEYS);
      const ev = E.TRAIN_EVENTS[k];
      // 流量/商务类事件：attendPop 选 0(吸粉)，否则选 1(专注训练)；其余选 0(主动成长支线)
      const POP_EV = { "漫展邀约": 1, "节目录制": 1, "商务邀约": 1, "短视频爆火": 1 };
      const idx = (k in POP_EV) ? (attendPop ? 0 : 1) : 0;
      ev.options[idx].apply(p); p._clamp();
      if (p._fired) throw { forced: "你被开除了！" };
    }
  }
  if (trained) E.rollInjury(p, age, false);
  // 自动理疗：带腱鞘炎且有钱就清(模拟玩家会处理)
  if (p.teno_active && p.money >= 600) { p.money -= 600; E.healInjury(p); }
}

function autoMatch(p, stage, oppPop, winPop, year, opts = {}) {
  const { oppBonus = 0, dayFirst = false } = opts;
  if (dayFirst) { p.stamina = E.matchStartStamina(p); p.fired_events = new Set(); }
  if (!p.fired_events) p.fired_events = new Set();
  p.stamina -= E.gameCost(stage);
  const fainted = p.stamina <= 0;
  let fdelta = 0;
  const ev = E.rollMatchEvent(p, { atMostOne: stage === "常规" });
  if (ev) { if (ev.needChoice) { fdelta = ev.options[0].resolve(p).fdelta; } else { fdelta = ev.fdelta || 0; } }
  const buff = p.nextGameBuff || 0; p.nextGameBuff = 0;
  const { F } = E.computeF(p, stage, oppPop, year, oppBonus, fdelta, buff);
  const { win } = E.settleGame(p, stage, oppPop, winPop, year, F, fainted, oppBonus);
  return { win, F };
}

function regular(p, year) {
  p.stamina = E.matchStartStamina(p); p.fired_events = new Set();
  let w = 0; for (let g = 0; g < 9; g++) if (autoMatch(p, "常规", E.OPP_POP["常规"], E.WIN_POP["常规"], year).win) w++;
  const others = []; for (let i = 0; i < 9; i++) { let x = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) x++; others.push(x); }
  const better = others.filter(o => o > w).length, ties = others.filter(o => o === w).length;
  p.recent_perf = w / 9;
  return 1 + better + E.randint(0, ties);
}

function playoff(p, seed, year) {
  const fl = [];
  const g = (dayFirst, key) => { const r = autoMatch(p, "季后", E.OPP_POP["季后"], E.WIN_POP["季后"], year, { dayFirst, oppBonus: key ? 2 : 0 }); fl.push(r.F); return r.win; };
  let place;
  if (seed <= 4) {
    const inWr1 = (seed === 1 || seed === 4);
    if (g(true, false)) {
      if (g(true, false)) place = g(true, true) ? 1 : 2;
      else if (g(true, true)) place = g(true, true) ? 1 : 2;
      else place = 3;
    } else if (inWr1) {
      if (!g(true, false)) place = 4;
      else if (!g(false, true)) place = 3;
      else place = g(true, true) ? 1 : 2;
    } else {
      if (!g(true, false)) place = 5;
      else if (!g(true, false)) place = 4;
      else if (!g(false, true)) place = 3;
      else place = g(true, true) ? 1 : 2;
    }
  } else {
    if (!g(true, false)) place = 6;
    else if (!g(true, false)) place = 5;
    else if (!g(true, false)) place = 4;
    else if (!g(false, true)) place = 3;
    else place = g(true, true) ? 1 : 2;
  }
  return { place, fl };
}

function domestic(p, kind, year, age) {
  E.rollInjury(p, age, true);
  const rank = regular(p, year);
  if (rank > 6) { E.endCompetition(p); return 8; }
  p.playoff_count += 1;
  const { place, fl } = playoff(p, rank, year);
  if (place === 1) E.settleChamp(p, kind, year, E.checkFMVP(p, year, fl).won);
  else if (place === 2) E.settleRunnerup(p, kind);
  else if (place === 3) E.settleThird(p, kind);
  E.endCompetition(p);
  return place;
}

function ivs(p, year, age) {
  E.rollInjury(p, age, true);
  p.stamina = E.matchStartStamina(p); p.fired_events = new Set();
  let w = 0; const fl = [];
  for (let g = 0; g < 3; g++) { const r = autoMatch(p, "IVS", E.OPP_POP["IVS"], E.WIN_POP["IVS"], year); fl.push(r.F); if (r.win) w++; else break; }
  if (w === 3) E.settleChamp(p, "IVS", year, E.checkFMVP(p, year, fl).won);
  else if (w === 2) E.settleRunnerup(p, "IVS");
  E.endCompetition(p);
}

function abyss(p, year, age, seeded) {
  E.rollInjury(p, age, true);
  if (!seeded) { p.stamina = E.matchStartStamina(p); p.fired_events = new Set(); let w = 0; for (let g = 0; g < 2; g++) if (autoMatch(p, "预选", E.OPP_POP["深渊"], E.WIN_POP["预选"], year).win) w++; if (w < 1) { E.endCompetition(p); return; } }
  p.stamina = E.matchStartStamina(p); p.fired_events = new Set();
  let wg = 0; for (let g = 0; g < 3; g++) if (autoMatch(p, "小组", E.OPP_POP["深渊"], E.WIN_POP["小组"], year).win) wg++;
  if (wg < 2) { E.endCompetition(p); return; }
  p.stamina = E.matchStartStamina(p); p.fired_events = new Set();
  const fl = []; const fg = (key) => { const r = autoMatch(p, "总决", E.OPP_POP["深渊"], E.WIN_POP["总决"], year, { oppBonus: key ? 2 : 0 }); fl.push(r.F); return r.win; };
  if (fg(false)) {
    if (fg(false)) { if (fg(true)) E.settleChamp(p, "深渊", year, E.checkFMVP(p, year, fl).won); else E.settleRunnerup(p, "深渊"); }
    else { if (fg(true)) E.settleThird(p, "深渊"); }
  }
  E.endCompetition(p);
}

function shop(p, cfg) {
  p.has_wrist = false; p.has_checkup = false;
  if (!cfg.shop) { if (cfg.therapy && p.teno_active && p.money >= 600) { p.money -= 600; E.healInjury(p); } return; }
  if (cfg.wrist && p.money >= 500) { p.money -= 500; p.has_wrist = true; }
  if (cfg.checkup && p.money >= 600) { p.money -= 600; p.has_checkup = true; }
  for (const it of E.SHOP_ITEMS) {
    if (it.kind !== "attr" || !(cfg.shopItems || []).includes(it.name)) continue;
    for (let q = 0; q < it.qty; q++) { if (p.money < it.price) break; p.money -= it.price; for (const [k, v] of Object.entries(it.eff)) p[k] = Math.min(100, p[k] + v); }
  }
  p._clamp();
}

function sel(p, year) {
  if (p.is_starter) return true;
  if (Math.random() < E.CONFIG.SELECT_VACANCY_P) { p.is_starter = true; p.ever_starter = true; p.consec_fail = 0; return true; }
  let thr = E.selectThreshold(year); if (p.identity === "主播" && year === 1) thr -= 3;
  if (p.cp + (p.luck - 50) * 0.1 >= thr) { p.is_starter = true; p.ever_starter = true; p.consec_fail = 0; return true; }
  p.consec_fail++; p.ever_fail = true; if (year === 1) p.first_year_failed = true;
  if (p.consec_fail >= 3) throw { forced: "饮水机管理员" };
  return false;
}

function career(cfg) {
  const p = new E.Player(cfg.identity, "T", "P", "求生者");
  if (cfg.appHigh) p.appearance = E.rnd(80, 100);
  let grand = false, forced = null, completed = 0;
  try {
    for (let year = 1; year <= 7; year++) {
      const age = 18 + year - 1; p.cur_year = year; p.year_f = [];
      p.negative_news = false;
      shop(p, cfg);
      p.rest_active = cfg.rest && !(p.identity === "青训" && year === 1) && E.commercialRestEligible(p);
      p.rest_growth_mult = p.rest_active ? E.CONFIG.REST_GROWTH_MULT : 1.0;
      const yc = new Set(); let sr = 8, ar = 8;
      const n1 = (p.identity === "青训" && year === 1) ? 7 : (p.rest_active ? 3 : 5);
      autoTrainPeriod(p, n1, year, age, cfg.attrs, cfg.intensity, cfg.attendPop);
      if (sel(p, year)) { const c = p.champ["夏"]; sr = domestic(p, "夏", year, age); if (p.champ["夏"] > c) yc.add("夏"); }
      if (E.transferRollForced(p) === "sell") E.doTransfer(p); E.transferAmbient(p);
      if (sr <= 2 && p.is_starter) { const c = p.champ["IVS"]; ivs(p, year, age); if (p.champ["IVS"] > c) yc.add("IVS"); }
      autoTrainPeriod(p, p.rest_active ? 3 : 5, year, age, cfg.attrs, cfg.intensity, cfg.attendPop);
      if (sel(p, year)) { const c = p.champ["秋"]; ar = domestic(p, "秋", year, age); if (p.champ["秋"] > c) yc.add("秋"); }
      autoTrainPeriod(p, p.rest_active ? 3 : 5, year, age, cfg.attrs, cfg.intensity, cfg.attendPop);
      if (sel(p, year)) { const seeded = (sr + ar) / 2 <= 2; p._abyss_fatigue = E.CONFIG.ABYSS_SYNC_FATIGUE * yc.size; const c = p.champ["深渊"]; abyss(p, year, age, seeded); p._abyss_fatigue = 0; if (p.champ["深渊"] > c) yc.add("深渊"); }
      if (["夏", "秋", "IVS", "深渊"].every(k => yc.has(k))) grand = true;
      E.transferAmbient(p); E.annualAwards(p, year);
      if (p.rest_active) { p.addPop(E.rnd(...E.CONFIG.REST_POP_RANGE)); p.rest_year_count += 1; }
      if (p.teno_active && p.teno_onset_year !== null && (year - p.teno_onset_year) >= 1) throw { forced: "伤重退役" };
      completed = year;
    }
  } catch (e) { if (e && e.forced) forced = e.forced; else throw e; }
  const full = (forced === null) && completed === 7;
  const ach = E.computeAchievements(p, full, grand, forced);
  const final = E.finalEnding(p, full, grand, forced, ach);
  return { final, total: p.totalChamp, abyssChamp: p.champ["深渊"], grand, forced, p };
}

const POLICIES = {
  "普通养成": { identity: "青训", attrs: [["单练", "tech"], ["团队训练", "tac"], ["体能训练", "phys"], ["直播排位", "stab"]], intensity: "正常", therapy: true },
  "重点养成": { identity: "青训", attrs: [["单练", "tech"], ["团队训练", "tac"]], intensity: "高强度", shop: true, wrist: true, shopItems: ["运动营养师", "《好心态决定电竞选手的一生》"], therapy: true },
  "极限养成": { identity: "人皇", attrs: [["单练", "tech"], ["团队训练", "tac"], ["体能训练", "phys"]], intensity: "高强度", shop: true, wrist: true, shopItems: ["运动营养师", "榜前绝活玩家的单练机会", "顶尖退役选手的复盘机会", "《好心态决定电竞选手的一生》", "私人陪练"], therapy: true },
  "颜值流量": { identity: "主播", appHigh: true, attendPop: true, attrs: [["体能训练", "phys"], ["直播排位", "stab"]], intensity: "正常", rest: true, shop: true, wrist: true, checkup: true, shopItems: [], therapy: true },
};

const N = parseInt(process.argv[2] || "8000", 10);
console.log(`冲烟测试 v2.3 · 每档 N=${N}`);
for (const [name, cfg] of Object.entries(POLICIES)) {
  let anyChamp = 0, ab = 0, grand = 0, retired = 0, benched = 0, fired = 0; const finals = {}; const attr = [0, 0, 0, 0]; let pf = 0;
  for (let i = 0; i < N; i++) {
    const r = career(cfg);
    if (r.total >= 1) anyChamp++;
    if (r.abyssChamp >= 1) ab++;
    if (r.grand) grand++;
    if (r.forced === "伤重退役") retired++;
    if (r.forced === "饮水机管理员") benched++;
    if (r.forced === "你被开除了！") fired++;
    finals[r.final] = (finals[r.final] || 0) + 1;
    attr[0] += r.p.tech; attr[1] += r.p.tac; attr[2] += r.p.phys; attr[3] += r.p.stab;
    pf += r.p.playoff_count;
  }
  const pc = x => (100 * x / N).toFixed(1) + "%";
  console.log(`\n[${name}] 技/战/体/稳=${attr.map(a => (a / N).toFixed(0)).join("/")}  进季后均=${(pf / N).toFixed(2)}`);
  console.log(`  任意冠=${pc(anyChamp)}  全球冠=${pc(ab)}  金满贯=${pc(grand)}  伤重退役=${pc(retired)}  饮水机=${pc(benched)}  被开除=${pc(fired)}`);
  console.log(`  结局Top:`, Object.fromEntries(Object.entries(finals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, pc(v)])));
}
console.log("\n对照《回归报告v2.3》：普通任意冠~中、极限全球冠较高、颜值流量伤重退役应被压低(≤~35%)、中层满役结局承接普通周目。");
