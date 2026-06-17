/* 冲烟测试 / 头脑风暴式回归 (v1.2)：用 JS 引擎(engine.js)自动重跑若干生涯，
 * 验证可玩切片的引擎移植没有崩溃，且夺冠率/结局分布与已验证脚本同量级。
 * 自动策略：训练总练最弱属性(正常强度)；突发事件统一选 0 号选项；
 * 赛中交互事件选 0 号选项。仅供开发期使用，可删。运行： node _smoketest.js 5000
 */
global.window = global;
require("./engine.js");
const E = global.IVL;

function autoTrainPeriod(p, n, year) {
  p.stamina = p.stamina_max;
  const attrs = ["tech", "tac", "phys", "stab"];
  for (let i = 0; i < n; i++) {
    // 选当前最弱属性对应的训练项目
    const weakest = attrs.reduce((a, b) => (p[a] <= p[b] ? a : b));
    const projMap = { tech: "单练", tac: "团队训练", phys: "体能训练", stab: "直播排位" };
    let proj = projMap[weakest];
    const cost = E.CONFIG.TRAIN[proj].cost;
    if (p.stamina < cost) proj = "休息";
    E.applyTraining(p, proj, "正常", year);

    // 事件：腱鞘炎 → 通用事件(选 0 号)
    const tenoP = 0.05 + (year - 1 + 18 - 18) * 0.015;
    if (proj !== "休息" && Math.random() < tenoP) {
      p.phys = Math.max(0, p.phys - 4); p.teno_next = true;
    } else if (proj !== "休息" && Math.random() < E.CONFIG.TRAIN_EVENT_P) {
      const key = E.TRAIN_EVENT_KEYS[Math.floor(Math.random() * E.TRAIN_EVENT_KEYS.length)];
      const ev = E.TRAIN_EVENTS[key];
      ev.options[0].apply(p);
      p._clamp();
      if (p._fired) throw { forced: "你被开除了！" };
    }
  }
}

function autoGame(p, stage, year, oppPopBase, winPop) {
  p.stamina -= 10;
  const fainted = p.stamina <= 0;
  const injuredBefore = p.injury_this_tourney;
  const cp = p.cp;
  const luckOff = (p.luck - 50) * 0.10;
  const V = 20 - p.stab * 0.15;
  const rfloat = E.rnd(-V, V);
  const diff = p.pop - oppPopBase;
  const cheer = diff >= 80 ? 5 : (diff >= 30 ? 3 : 0);

  let fdelta = 0;
  const evt = E.rollMatchEvent(p);
  if (evt.needChoice) {
    const opt = evt.options[0];
    if (evt.custom) { const r = opt.apply(p); fdelta = r.f; }
    else { opt.apply(p); fdelta = opt.fdelta || 0; }
  } else fdelta = evt.fdelta || 0;

  const buff = p.nextGameBuff; p.nextGameBuff = 0;
  let inner = cp + luckOff + rfloat + cheer + fdelta + buff;
  if (p.teno_next) { inner -= 12; p.teno_next = false; }
  if (injuredBefore) inner -= 8;
  if (p.stamina < 20) inner -= 15;
  if (p.negative_news) inner *= 0.90;
  const F = Math.max(0, Math.min(100, inner));
  const team = 0.8 * F + 0.2 * E.npcSelf(year);
  const opp = E.sampleOpp(stage, year);
  const win = (!fainted) && (team > opp);
  if (win) { p.addPop(winPop); p.money += 100; }
  return { win, F };
}

function autoKnockout(p, stage, year, oppPopBase, winPop) {
  p.stamina = p.stamina_max;
  let wins = 0; const fList = [];
  for (let g = 0; g < 3; g++) {
    const r = autoGame(p, stage, year, oppPopBase, winPop);
    fList.push(r.F);
    if (r.win) wins++; else break;
  }
  if (wins === 3) return { champ: true, runner: false, place: 1, fList };
  if (wins === 2) return { champ: false, runner: true, place: 2, fList };
  if (wins === 1) return { champ: false, runner: false, place: 4, fList };
  return { champ: false, runner: false, place: 6, fList };
}

function autoRegular(p, year) {
  p.injury_this_tourney = false; p.stamina = p.stamina_max;
  let wins = 0;
  for (let g = 0; g < 9; g++) if (autoGame(p, "常规", year, E.OPP_POP["常规"], E.WIN_POP["常规"]).win) wins++;
  const others = []; for (let i = 0; i < 9; i++) { let w = 0; for (let k = 0; k < 9; k++) if (Math.random() < 0.5) w++; others.push(w); }
  const better = others.filter(w => w > wins).length;
  const ties = others.filter(w => w === wins).length;
  const rank = 1 + better + E.randint(0, ties);
  return { rank, inPlayoff: rank <= 6 };
}

function settle(p, kind, r) {
  if (r.champ) { const fm = E.checkFMVP(p, /*year*/ p._year, r.fList); E.settleChamp(p, kind, fm.won); }
  else if (r.runner) E.settleRunnerup(p, kind);
}

function autoSelection(p, year) {
  if (p.is_starter) return true;
  if (Math.random() < E.CONFIG.SELECT_VACANCY_P) { p.is_starter = true; p.ever_starter = true; p.consec_fail = 0; return true; }
  const score = p.cp + (p.luck - 50) * 0.1;
  let thr = E.selectThreshold(year);
  if (p.identity === "主播" && year === 1) thr -= 3;
  if (score >= thr) { p.is_starter = true; p.ever_starter = true; p.consec_fail = 0; return true; }
  p.consec_fail += 1;
  if (year === 1) p.first_year_failed = true;
  if (p.consec_fail >= 3) throw { forced: "饮水机管理员" };
  return false;
}

function runCareer(identity) {
  const p = new E.Player(identity, "AUTO", "求生者");
  let grandSlam = false, forced = null;
  try {
    for (let year = 1; year <= E.CONFIG.YEARS; year++) {
      p._year = year;
      p.has_wrist = false; p.negative_news = false;
      const yc = new Set();
      let summerRank = 8, autumnRank = 8;
      autoTrainPeriod(p, (identity === "青训" && year === 1) ? 7 : 5, year);
      if (autoSelection(p, year)) {
        const reg = autoRegular(p, year);
        if (reg.inPlayoff) { const r = autoKnockout(p, "季后", year, E.OPP_POP["季后"], E.WIN_POP["季后"]); summerRank = r.place; settle(p, "夏", r); if (r.champ) yc.add("夏"); }
      }
      if (summerRank <= 2 && p.is_starter) { const r = autoKnockout(p, "IVS", year, E.OPP_POP["IVS"], E.WIN_POP["IVS"]); settle(p, "IVS", r); if (r.champ) yc.add("IVS"); }
      autoTrainPeriod(p, 5, year);
      if (autoSelection(p, year)) {
        const reg = autoRegular(p, year);
        if (reg.inPlayoff) { const r = autoKnockout(p, "季后", year, E.OPP_POP["季后"], E.WIN_POP["季后"]); autumnRank = r.place; settle(p, "秋", r); if (r.champ) yc.add("秋"); }
      }
      autoTrainPeriod(p, 5, year);
      if (autoSelection(p, year)) {
        const seeded = (summerRank + autumnRank) / 2 <= 2.0;
        let pass = true;
        if (!seeded) { let w = 0; for (let g = 0; g < 2; g++) if (autoGame(p, "预选", year, E.OPP_POP["深渊"], E.WIN_POP["预选"]).win) w++; pass = w >= 1; }
        if (pass) {
          let wg = 0; for (let g = 0; g < 3; g++) if (autoGame(p, "小组", year, E.OPP_POP["深渊"], E.WIN_POP["小组"]).win) wg++;
          if (wg >= 2) { const r = autoKnockout(p, "总决", year, E.OPP_POP["深渊"], E.WIN_POP["总决"]); settle(p, "深渊", r); if (r.champ) yc.add("深渊"); }
        }
      }
      if (["夏", "秋", "IVS", "深渊"].every(k => yc.has(k))) grandSlam = true;
      const trigs = E.specialTriggers(p, year);
      for (const name of trigs) { if (!p.offered.has(name)) { p.offered.add(name); /* auto: decline */ } }
    }
  } catch (e) { if (e && e.forced) forced = e.forced; else throw e; }
  const ending = E.finalEnding(p, grandSlam, forced);
  return { ending, champ: p.totalChamp, fmvp: p.fmvp_total, pop: p.pop, tech: p.tech, tac: p.tac, phys: p.phys, stab: p.stab };
}

/* ------------------------------- 主程序 -------------------------------- */
const N = parseInt(process.argv[2] || "5000", 10);
const ids = ["青训", "主播", "人皇"];
for (const id of ids) {
  const endings = {}; let champSum = 0, fmvpSum = 0, popSum = 0;
  const at = { tech: 0, tac: 0, phys: 0, stab: 0 };
  for (let i = 0; i < N; i++) {
    const r = runCareer(id);
    endings[r.ending] = (endings[r.ending] || 0) + 1;
    champSum += r.champ; fmvpSum += r.fmvp; popSum += r.pop;
    at.tech += r.tech; at.tac += r.tac; at.phys += r.phys; at.stab += r.stab;
  }
  console.log(`\n=== 身份：${id}  (N=${N}) ===`);
  console.log(`平均冠军 ${(champSum / N).toFixed(2)} · 平均FMVP ${(fmvpSum / N).toFixed(2)} · 平均人气 ${(popSum / N).toFixed(1)}万`);
  console.log(`平均属性 技${(at.tech / N).toFixed(1)} 战${(at.tac / N).toFixed(1)} 体${(at.phys / N).toFixed(1)} 稳${(at.stab / N).toFixed(1)}`);
  console.log("结局分布：");
  Object.entries(endings).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(8, "　")} ${(v / N * 100).toFixed(1)}%  (${v})`));
}
