/* 冲烟测试 / 头脑风暴式回归 (v3.0)：用 JS 引擎(engine.js)自动重跑若干档位，
 * 验证切片引擎移植没有崩溃、且夺冠率与蒙特卡洛 v2.5（数值 v6.0）同量级。
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
      const k = E.pickTrainingEvent(p);     // v6.0：容貌/休整加权抽取
      const ev = E.TRAIN_EVENTS[k];
      // 商业/流量类事件：attendPop 选吸粉档，否则选专注成长档；其余默认 0。
      // 值 = [popIdx, growthIdx]；options 不足时由 clamp 兜底。
      const POP_EV = {
        "漫展邀约": [0, 1], "节目录制": [0, 1], "商务邀约": [0, 1], "短视频爆火": [0, 1],
        "可惜为时已晚": [1, 0], "线下偶遇": [0, 1], "马甲掉了": [0, 1], "嘉宾解说": [0, 2],
      };
      let idx = 0;
      if (k in POP_EV) { idx = attendPop ? POP_EV[k][0] : POP_EV[k][1]; }
      idx = Math.min(idx, ev.options.length - 1);
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
  if (cfg.wrist && p.money >= 300) { p.money -= 300; p.has_wrist = true; }
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
      p.rest_active = cfg.rest && !(p.identity === "青训" && year === 1) && E.commercialRestEligible(p, year);
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
      if (sel(p, year)) { const seeded = (sr + ar) / 2 <= 2; p._abyss_fatigue = Math.min(E.CONFIG.ABYSS_SYNC_FATIGUE_CAP, E.CONFIG.ABYSS_SYNC_FATIGUE_PER * yc.size); const c = p.champ["深渊"]; abyss(p, year, age, seeded); p._abyss_fatigue = 0; if (p.champ["深渊"] > c) yc.add("深渊"); }
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
console.log(`冲烟测试 v3.0 · 每档 N=${N}`);
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
console.log("\n对照蒙特卡洛 v2.5（数值 v6.0）：冠军疲劳减负 + 深渊下调后金满贯/全球冠应上升；颜值流量伤重退役仍应被压低(≤~35%)、中层满役结局承接普通周目。");

/* ===================== 单槽续局存档 · 序列化断言（demov4.3feedback） =====================
 * 覆盖最易出错处:Set 字段还原、getter/方法经原型链幸存、往返数值一致、老档缺字段有默认兜底。
 * 断言失败即抛错(非零退出),不得 TODO 跳过。 */
(function testRunSaveSerialization() {
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails++; console.error("  ✗ " + msg); } };

  // 造一个带各类字段的进行中存档态(Set / 嵌套对象 / 计数器 / 续局标记)。
  const p = new E.Player("青训", "Nova", "Ace", "求生者");
  p.tech = 88; p.tac = 77; p.phys = 66; p.stab = 55; p.appearance = 42;
  p.money = 4321; p.pop = 12.5; p.champ["夏"] = 2; p.champ["深渊"] = 1;
  p.inv["柠檬水"] = 3; p.transfer_count = 2; p.npc_growth = 7;
  p.pet_cat = { adoptYear: 3, followupDone: false };
  p.spotlight.add("残血翻盘"); p.spotlight.add("极限救人");
  p.offered.add("金满贯特典");
  p._poppedAchs = new Set(["万能螺丝"]);
  p._grandSlam = true;
  p.cur_year = 4;

  // 走真实存档路径:JSON 序列化(触发 toJSON) → 反序列化 → 重建 Player。
  const wire = JSON.parse(JSON.stringify({ player: p.toJSON() }));
  const q = E.Player.fromSave(wire.player);

  // 1) 标量 / 嵌套对象往返一致
  ok(q.tech === 88 && q.tac === 77 && q.phys === 66 && q.stab === 55, "四维往返一致");
  ok(q.money === 4321 && Math.abs(q.pop - 12.5) < 1e-9, "资金/人气往返一致");
  ok(q.champ["夏"] === 2 && q.champ["深渊"] === 1, "冠军计数嵌套对象往返一致");
  ok(q.inv["柠檬水"] === 3, "背包嵌套对象往返一致");
  ok(q.pet_cat && q.pet_cat.adoptYear === 3 && q.pet_cat.followupDone === false, "宠物嵌套对象往返一致");
  ok(q._grandSlam === true && q.cur_year === 4, "续局标记/年份往返一致");

  // 2) Set 字段必须还原为真正的 Set,且成员一致(否则续局后 has()/add() 会崩)
  ok(q.spotlight instanceof Set && q.spotlight.has("残血翻盘") && q.spotlight.has("极限救人") && q.spotlight.size === 2, "spotlight 还原为 Set");
  ok(q.offered instanceof Set && q.offered.has("金满贯特典"), "offered 还原为 Set");
  ok(q._poppedAchs instanceof Set && q._poppedAchs.has("万能螺丝"), "_poppedAchs 还原为 Set");

  // 3) getter / 方法经原型链幸存,且计算值与原实例一致
  ok(typeof q.cp === "number" && Math.abs(q.cp - p.cp) < 1e-9, "getter cp 幸存且一致");
  ok(Math.abs(q.pop_mult - p.pop_mult) < 1e-9, "getter pop_mult 幸存且一致");
  ok(q.totalChamp === p.totalChamp, "getter totalChamp 幸存且一致");
  ok(typeof q.advanceTeammate === "function", "方法 advanceTeammate 幸存");
  const g0 = q.npc_growth; const gain = q.advanceTeammate();
  ok(typeof gain === "number" && q.npc_growth === g0 + gain, "方法 advanceTeammate 可正常调用");

  // 4) 老档缺字段:fromSave 先造默认实例再覆盖,缺失字段应取构造默认值(前向兼容)
  const partial = { identity: "青训", teamName: "Nova", playerId: "Ace", role: "求生者", tech: 90 };
  const r = E.Player.fromSave(partial);
  ok(r.tech === 90, "老档已有字段覆盖成功");
  ok(r.inv && r.inv["柠檬水"] === 0 && r.champ && r.champ["夏"] === 0, "老档缺失字段回落默认值");
  ok(r.offered instanceof Set && r.spotlight instanceof Set, "老档缺失 Set 字段回落为空 Set");

  if (fails) { throw new Error(`续局存档序列化断言失败:${fails} 项未通过`); }
  console.log("\n[续局存档] 序列化/反序列化断言全部通过（Set 还原 · getter/方法幸存 · 往返一致 · 老档兜底）。");
})();
