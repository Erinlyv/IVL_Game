/* =============================================================================
 * IVL 模拟器 · 引擎 (engine.js) · 垂直可玩切片 第二版 v2.3
 * 严格移植自《测试脚本/montecarlo_ivl.py》v2.3（对齐《测试版 v2.3》/《数值设计 v5.2》/
 * 《策划案 v6.3》/《文案设计 v1.1》）。把脚本里的"策略自动决策"替换为玩家点击，
 * 数值 / 公式逐项保持一致，使 demo 手感与已回归的平衡同源。
 *
 * v2.3 新增（相对 demo v1.2）：双败季后赛 / 深渊季军赛 / 完整伤病系统（临时 + 腱鞘炎 +
 * 伤重退役）/ 转会 / 年度评选 / 商业休整 / 经纪团队体检 / 中层满役结局三档 /
 * 赛季目标面板 / 赛后因果解释 reasonTags / 伤病风险预警 / 商店推荐标签 / v6.3 结局成就。
 * feedback15：运气为完全隐藏数值；突发事件选项不预显数值，选完才公布。
 *
 * 本文件只放"纯逻辑 / 数据"（无 DOM）。交互编排在 game.js。
 * ===========================================================================*/

/* ----------------------------- 随机数工具 ------------------------------ */
function rnd(a, b) { return a + Math.random() * (b - a); }
function randint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function triangular(low, high, mode) {
  const u = Math.random();
  const c = (mode - low) / (high - low);
  if (u < c) return low + Math.sqrt(u * (high - low) * (mode - low));
  return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}
function gauss(mean, sd) {
  const u = 1 - Math.random(), v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function choiceOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ------------------------------- CONFIG -------------------------------- */
const CONFIG = {
  YEARS: 7,
  START_AGE: 18,

  TRAIN: {
    "单练":   { tech: 2, tac: 0, phys: 1, stab: 0, pop: 0.0, cost: 22 },
    "团队训练": { tech: 1, tac: 2, phys: 0, stab: 0, pop: 0.0, cost: 22 },
    "体能训练": { tech: 0, tac: 0, phys: 2, stab: 1, pop: 0.0, cost: 18 },
    "直播排位": { tech: 0, tac: 1, phys: 0, stab: 2, pop: 0.5, cost: 15 },
    "休息":   { tech: 0, tac: 0, phys: 0, stab: 0, pop: 0.0, cost: -50 },
  },
  INTENSITY: { "休养": [0.8, 0.8], "正常": [1.0, 1.0], "高强度": [1.2, 1.2] },

  TRAIN_EVENT_P: 0.32,
  SOFTCAP_DIV: 80.0,

  // 伤病
  P_TEMP: 0.05, TENO_CAP: 0.15, TENO_RELAPSE_RESIDUAL: 0.03,
  INJ_TEMP_F: 6, INJ_TENO_F: 10,
  WRIST_MULT: 0.4, CHECKUP_MULT: 0.4,

  // 商业休整
  REST_TRAIN_N: 3, REST_GROWTH_MULT: 0.8, REST_INJURY_MULT: 0.5, REST_POP_RANGE: [2, 5],

  // 体力
  GAME_STAMINA_COST: { "常规": 6 }, DEFAULT_GAME_STAMINA_COST: 10, MATCH_START: 70,

  ABYSS_SYNC_FATIGUE: 5,

  W_TECH: 0.40, W_TAC: 0.35, W_PHYS: 0.15, W_STAB: 0.10,

  WIN_POP: { "常规": 0.5, "季后": 1.0, "IVS": 2.0, "预选": 1.0, "小组": 3.0, "总决": 10.0 },
  OPP_POP: { "常规": 5, "季后": 20, "IVS": 50, "深渊": 80 },

  CHAMP_REWARD: { "夏": [30, 3000], "秋": [30, 3000], "IVS": [25, 2000], "深渊": [120, 10000] },
  FMVP_REWARD: [20, 1500],
  RUNNERUP_POP: 8, THIRD_POP: 4,

  SELECT_VACANCY_P: 0.05,
  FMVP_F_MIN: 90,
  BEST_PERF_F_MIN: 88,

  TRANSFER_P_BASE: 0.08, TRANSFER_P_HIGH: 0.12, TRANSFER_PERF_SELL: 0.40,
  TEAMMATE_IN_P: 0.12, TEAMMATE_OUT_P: 0.12, OTHER_TEAM_P: 0.25,
};

function selectThreshold(year) { return 32 + (year - 1) * 2.5; }
function npcSelf(year) { return Math.min(68, 58 + (year - 1)); }
function growthTech(year) { return year <= 3 ? 1.0 : Math.max(0.60, 1 - 0.05 * (year - 3)); }
const growthPhys = growthTech;
function growthTac(year) { return year <= 3 ? 1.0 : Math.max(0.75, 1 - 0.03 * (year - 3)); }
function oppDelta(year) { return Math.min(1.5 * (year - 1), 6); }
function popThr3(year) { return 120 + (year - 1) * 15; }

function sampleOpp(stage, year, extra = 0) {
  const d = oppDelta(year) + extra;
  if (stage === "常规") {
    if (year === 1) return triangular(31, 58, 46);
    return triangular(45, 72, 60) + d;
  }
  if (stage === "季后") return rnd(65, 83) + d;
  if (stage === "IVS") return rnd(70, 84) + d;
  if (stage === "预选") return rnd(44, 64) + d;
  if (stage === "小组") return rnd(58, 74) + d;
  if (stage === "总决") return rnd(70, 82) + d;
  throw new Error("unknown stage " + stage);
}

/* ------------------------------- 商店 ---------------------------------- *
 * kind: 'attr' 立即生效属性; 'consume' 进背包; 'wrist' 当年护腕;
 *       'checkup' 当年经纪团队体检; 'clear' 立即清 debuff
 * tag(UI 推荐标签) 来自《文案设计 v1.1》/《feedback15》。
 * --------------------------------------------------------------------- */
const SHOP_ITEMS = [
  { name: "柠檬水", price: 100, qty: 5, kind: "consume", slot: "stam", val: 30, group: "体力恢复",
    desc: "体力 +30（可携带，比赛/训练中使用）", tag: "小口回血，大场面不掉链子" },
  { name: "筋膜枪", price: 300, qty: 3, kind: "consume", slot: "stam", val: 60, group: "体力恢复",
    desc: "体力 +60（可携带）", tag: "赛前十分钟，续命一整场" },
  { name: "护腕", price: 500, qty: 1, kind: "wrist", group: "伤病防护",
    desc: "当年比赛受伤概率 ×0.4（可与体检叠加）", tag: "电竞选手的手是第二个心脏" },
  { name: "经纪团队体检", price: 600, qty: 1, kind: "checkup", group: "伤病防护",
    desc: "当年伤病判定概率 ×0.4（训练+比赛，可与护腕叠加）", tag: "定期体检，是对热度最划算的投资" },
  { name: "理疗康复套餐", price: 600, qty: 2, kind: "consume", slot: "heal", group: "伤病防护",
    desc: "清除腱鞘炎/临时伤病（可携带）", tag: "腱鞘炎唯一指定救星。疼痛可以忍，职业生涯不能赌。" },
  { name: "好运签", price: 500, qty: 2, kind: "consume", slot: "fbuff", val: 8, group: "临场爆发",
    desc: "下一场比赛 F +8（可携带）", tag: "玄学不一定有用，但冠军都信一点" },
  { name: "战术分析仪", price: 700, qty: 1, kind: "consume", slot: "fbuff", val: 6, group: "临场爆发",
    desc: "下一场 F +6（可携带）", tag: "比对手早看懂一回合" },
  { name: "定制应援物料", price: 400, qty: 2, kind: "consume", slot: "fbuff", val: 5, pop: 0.5, group: "临场爆发",
    desc: "下一场 F +5、人气 +0.5（可携带）", tag: "灯牌亮起来的那一刻，主场就不只是地图，而是站在你身后的海。" },
  { name: "榜前绝活玩家的单练机会", price: 600, qty: 2, kind: "attr", eff: { tech: 5 }, group: "属性成长",
    desc: "技术 +5（立即，不受衰减）", tag: "跟高手练一把，胜过自己磨一周" },
  { name: "顶尖退役选手的复盘机会", price: 600, qty: 2, kind: "attr", eff: { tac: 5 }, group: "属性成长",
    desc: "战术 +5（立即）", tag: "站在前人肩膀上看地图" },
  { name: "《好心态决定电竞选手的一生》", price: 600, qty: 2, kind: "attr", eff: { stab: 4 }, group: "属性成长",
    desc: "稳定性 +4（立即）", tag: "手会抖，但读完这本你不慌" },
  { name: "运动营养师", price: 800, qty: 2, kind: "attr", eff: { phys: 4 }, group: "属性成长",
    desc: "体能 +4（立即）", tag: "身体是 1，其它是后面的 0" },
  { name: "私人陪练", price: 1200, qty: 2, kind: "attr", eff: { tech: 2, tac: 2 }, group: "属性成长",
    desc: "技术 +2、战术 +2（立即）", tag: "全能不是天赋，是有人陪你磨" },
  { name: "俱乐部公关团队", price: 1200, qty: 1, kind: "clear", slot: "news", group: "舆论处理",
    desc: "立即清除负面新闻 debuff", tag: "黑热搜会过去，但关键比赛不会等你慢慢调整心情。" },
];

/* ------------------------------ Player --------------------------------- */
class Player {
  constructor(identity, name, role) {
    this.identity = identity;
    this.name = name || "无名选手";
    this.role = role || "求生者";

    this.appearance = rnd(1, 100);
    this.phys = rnd(35, 45);
    this.tech = rnd(25, 35);
    this.tac = rnd(25, 35);
    this.stab = rnd(25, 35);
    this.luck = rnd(1, 100);          // feedback15: 完全隐藏数值
    this.money = 1000;
    this.pop = 1;
    this.stamina = 0;

    if (identity === "青训") {
      for (const k of ["phys", "tech", "tac", "stab"]) this[k] += 3;
    } else if (identity === "主播") {
      this.stab += 3; this.money = 3000; this.pop = 20;
    } else if (identity === "人皇") {
      this.tech += 12; this.tac += 5;
    }
    this._clamp();

    // 选拔 / 主力
    this.is_starter = false;
    this.consec_fail = 0;
    this.first_year_failed = false;
    this.ever_starter = false;
    this.ever_fail = false;

    // 道具 / debuff
    this.has_wrist = false;
    this.has_checkup = false;
    this.negative_news = false;
    this.ever_negative = false;
    this.nextGameBuff = 0;            // 道具临时 F buff，下一场生效后清零
    this._abyss_fatigue = 0;
    this.inj_train_mult = 1.0;        // 体检预警·硬扛：当周期伤病概率 ×1.5

    // 伤病
    this.temp_active = false;
    this.temp_count = 0;
    this.teno_active = false;
    this.teno_count = 0;
    this.teno_cured = false;
    this.teno_onset_year = null;
    this.ever_injured = false;

    // 商业休整
    this.rest_active = false;
    this.rest_growth_mult = 1.0;
    this.rest_year_count = 0;
    this.playoff_count = 0;

    // 转会 / 战队
    this.transfer_count = 0;
    this.npc_offset = 0;
    this.opp_delta_extra = 0;
    this.recent_perf = 1.0;

    // 计数器
    this.champ = { "夏": 0, "秋": 0, "IVS": 0, "深渊": 0 };
    this.runnerups = 0;
    this.thirds = 0;
    this.fmvp_total = 0;
    this.fmvp_seq = [];
    this.ev_count = 0;
    this.won_with_teno = false;
    this.injured_win = 0;

    // 年度 / 年内
    this.cur_year = 0;
    this.year_f = [];
    this.best_perf_count = 0;
    this.popular_count = 0;
    this.champ_per_year = {};
    this.fmvp_per_year = {};
    this.first_champ_year = null;
    this.last_award = null;          // 本年度评选结果(展示)

    // 背包(可携带消耗品)
    this.inv = { "柠檬水": 0, "筋膜枪": 0, "好运签": 0, "定制应援物料": 0, "战术分析仪": 0, "理疗康复套餐": 0 };

    // 记录
    this.titles = [];
    this.offered = new Set();
    this._fired = false;
    this.nextGameBuffUsed = false;
  }

  _clamp() {
    for (const k of ["appearance", "phys", "tech", "tac", "stab", "luck"]) {
      this[k] = clamp(this[k], 0, 100);
    }
  }
  get pop_mult() { return 0.5 + this.appearance / 100; }
  get stamina_max() { return 100 + (this.phys - 50) * 0.6; }
  get cp() {
    return this.tech * CONFIG.W_TECH + this.tac * CONFIG.W_TAC +
           this.phys * CONFIG.W_PHYS + this.stab * CONFIG.W_STAB;
  }
  teamNpc(year) { return clamp(npcSelf(year) + this.npc_offset, 40, 80); }
  addPop(base) { this.pop += base * this.pop_mult; }
  grow(attr, amount) {
    if (amount <= 0) { this[attr] = Math.max(0, this[attr] + amount); return; }
    const cur = this[attr];
    const factor = clamp((100 - cur) / CONFIG.SOFTCAP_DIV, 0, 1);
    this[attr] = Math.min(100, cur + amount * factor);
  }
  get totalChamp() { return this.champ["夏"] + this.champ["秋"] + this.champ["IVS"] + this.champ["深渊"]; }
}

/* ------------------------------ 伤病 ----------------------------------- */
function tenoProb(p, age) {
  const base = 0.02 + (age - 18) * 0.01 + 0.01 * p.temp_count +
               (p.teno_cured ? CONFIG.TENO_RELAPSE_RESIDUAL : 0);
  return Math.min(CONFIG.TENO_CAP, base);
}
// 掷骰受伤(先腱鞘炎后临时, 互斥)。返回 'teno' | 'temp' | null。
function rollInjury(p, age, inMatch) {
  const wrist = p.has_wrist ? CONFIG.WRIST_MULT : 1.0;
  const checkup = p.has_checkup ? CONFIG.CHECKUP_MULT : 1.0;
  const rest = p.rest_active ? CONFIG.REST_INJURY_MULT : 1.0;
  const mult = (inMatch ? 1.0 : p.inj_train_mult) * checkup * rest;
  if (!p.teno_active && Math.random() < tenoProb(p, age) * wrist * mult) {
    p.teno_active = true; p.teno_count += 1; p.teno_onset_year = p.cur_year;
    p.ever_injured = true; return "teno";
  }
  if (Math.random() < CONFIG.P_TEMP * wrist * mult) {
    p.temp_active = true; p.temp_count += 1; p.ever_injured = true; return "temp";
  }
  return null;
}
function healInjury(p) {  // 理疗康复套餐：清两类伤病
  const had = p.teno_active || p.temp_active;
  if (p.teno_active) { p.teno_active = false; p.teno_cured = true; p.teno_onset_year = null; }
  p.temp_active = false;
  return had;
}
function endCompetition(p) { p.temp_active = false; }  // 赛季结束临时伤病自动清

/* ---------------------------- 训练应用 --------------------------------- */
function applyTraining(p, proj, intensity, year) {
  let [eff, sm] = CONFIG.INTENSITY[intensity];
  eff *= p.rest_growth_mult;
  const t = CONFIG.TRAIN[proj];
  const gt = growthTech(year), gtc = growthTac(year), gp = growthPhys(year);
  if (t.tech) p.grow("tech", t.tech * eff * gt);
  if (t.tac) p.grow("tac", t.tac * eff * gtc);
  if (t.phys) p.grow("phys", t.phys * eff * gp);
  if (t.stab) p.grow("stab", t.stab * eff);
  if (t.pop) p.addPop(t.pop * eff);
  p.stamina = Math.min(p.stamina_max, p.stamina - t.cost * sm);
  p._clamp();
}

/* ------------------------------- 比赛 ---------------------------------- */
const MATCH_START_FLAT = CONFIG.MATCH_START;            // 进入比赛日体力回到 70
function matchStartStamina(p) { return Math.min(p.stamina_max, MATCH_START_FLAT); }
function gameCost(stage) { return CONFIG.GAME_STAMINA_COST[stage] || CONFIG.DEFAULT_GAME_STAMINA_COST; }
function luckCheck(p) { return p.luck + rnd(0, 40) >= 70; }

/* 比赛期事件(6 件), 同一比赛阶段每种至多一次(p.fired_events)。
 * feedback15: 选项 label 不含数值; 选完由 resolve() 返回 {fdelta, txt}。
 * 返回: {auto:true, fdelta, txt} | {needChoice:true, key, flavor, options:[{label, resolve}]} | null */
function rollMatchEvent(p) {
  const fe = p.fired_events;
  const seq = [["火热", 0.005], ["BP", 0.08], ["设备", 0.06], ["应援扇", 0.05], ["守椅", 0.07], ["加时", 0.05]];
  for (const [name, prob] of seq) {
    if (fe.has(name)) continue;
    if (Math.random() < prob) {
      fe.add(name);
      if (name === "火热") {
        return { needChoice: true, key: "火热进行中",
          flavor: "比赛进行当中，赛场突然小范围起火。正在选手席上的你选择——",
          options: [
            { label: "坐怀不乱，比赛优先", resolve(pl) { pl.addPop(3); return { fdelta: 0, txt: "你沉着的表现吸引了一大批粉丝。人气 +3。" }; } },
            { label: "两股战战，几欲先走", resolve(pl) { pl.money += 500; return { fdelta: 0, txt: "看到你被吓得够呛，官方给了你一笔补偿金。资金 +500。" }; } },
          ] };
      }
      if (name === "BP") {
        return { needChoice: true, key: "BP 风波",
          flavor: "BP 阶段，教练与你思路产生了分歧。",
          options: [
            { label: "选版本强势但熟练度不够的新角色", resolve(pl) {
                if (pl.tech >= 70 && luckCheck(pl)) return { fdelta: 10, txt: "这一手奇兵直接把对面打懵，BP 优势瞬间变成场上优势！本场 F +10。" };
                return { fdelta: -8, txt: "新角色手感没找回来，反被对面针对得死死的。本场 F −8。" };
              } },
            { label: "选择绝活角色", resolve() { return { fdelta: -3, txt: "你还是选择了自己的老伙计，对面对此也早有准备。本场 F −3。" }; } },
          ] };
      }
      if (name === "设备") {
        return { needChoice: true, key: "设备调试中",
          flavor: "你今天感觉施放技能的时候总是不那么顺畅，或许是设备原因？你选择——",
          options: [
            { label: "申请暂停", resolve(pl) { pl.grow("stab", 2); return { fdelta: -4, txt: "你举手叫了裁判，工作人员上来一通排查。你的状态也因此受到了一些影响。稳定 +2，本场 F −4。" }; } },
            { label: "硬刚", resolve(pl) { let ex = ""; if (pl.tech >= 70 && luckCheck(pl)) { pl.addPop(4); ex = " 你顶着别扭感打出名场面，人气 +4！"; } return { fdelta: -6, txt: "你决定将就着打，设备的别扭感全程跟着你。本场 F −6。" + ex }; } },
          ] };
      }
      if (name === "应援扇") { p.addPop(2); return { auto: true, fdelta: 4, txt: "看台某个角落突然举起一整片你的应援扇，灯牌连成一条线，喊你 ID 的声浪盖过了全场。你的后背也挺直了几分。人气 +2，本场 F +4。" }; }
      if (name === "守椅") {
        return { needChoice: true, key: "守椅博弈",
          flavor: "比赛来到最吃博弈的守椅回合——救与守、进与退，只在一念之间。你选择——",
          options: [
            { label: "放手一搏，强行博弈", resolve(pl) { if (luckCheck(pl)) return { fdelta: 12, txt: "一记漂亮的处理打乱了对手节奏，局势倒向你这边！本场 F +12。" }; pl.stab = Math.max(0, pl.stab - 2); return { fdelta: -8, txt: "你抢早了半拍，反被抓住破绽，局面急转直下。本场 F −8，稳定 −2。" }; } },
            { label: "按部就班，稳健处理", resolve(pl) { if (pl.tac >= 65) return { fdelta: 6, txt: "你忍住没冲，按既定节奏稳稳推进，不给对手任何可乘之机。本场 F +6。" }; return { fdelta: 2, txt: "你按部就班地处理，没出乱子。本场 F +2。" }; } },
          ] };
      }
      if (name === "加时") {
        // 加时赛：无主动选项，按稳定性结算(文案设计 §十.B.6)
        if (p.stab >= 70) { p.addPop(1); return { auto: true, fdelta: 8, txt: "常规局战成平手，比赛被拖进加时赛。越是神经紧绷的时刻你越冷静，手稳得像没事人，硬生生用时间优势拿下这一场。本场 F +8，人气 +1。" }; }
        return { auto: true, fdelta: -8, txt: "常规局战成平手，比赛被拖进加时赛。灯光、解说、心跳全糊成一片，最关键的那一下，你的心乱了。本场 F −8。" };
      }
    }
  }
  return null;
}

// 计算本场 F(吃完事件 fdelta + 道具 buff)
function computeF(p, stage, oppPopBase, year, oppBonus, fdelta, buff) {
  const cp = p.cp;
  const luckOff = (p.luck - 50) * 0.10;
  const V = 20 - p.stab * 0.15;
  const rfloat = rnd(-V, V);
  const diff = p.pop - oppPopBase;
  const cheer = diff >= 80 ? 5 : (diff >= 30 ? 3 : 0);
  let inner = cp + luckOff + rfloat + cheer + fdelta + buff;
  if (stage === "预选" || stage === "小组" || stage === "总决") inner -= p._abyss_fatigue;
  if (p.temp_active) inner -= CONFIG.INJ_TEMP_F;
  if (p.teno_active) inner -= CONFIG.INJ_TENO_F;
  if (p.stamina < 20) inner -= 15;
  if (p.negative_news) inner *= 0.90;
  return { F: clamp(inner, 0, 100), cheer, luckOff, rfloat };
}

// 结算一场：返回 {win, team, opp}
function settleGame(p, stage, oppPopBase, winPop, year, F, fainted, oppBonus) {
  const team = 0.8 * F + 0.2 * p.teamNpc(year);
  const opp = sampleOpp(stage, year) + (oppBonus || 0) + p.opp_delta_extra;
  const win = (!fainted) && (team > opp);
  p.year_f.push(F);
  if (win) {
    p.addPop(winPop); p.money += 100;
    if (p.temp_active || p.teno_active) p.injured_win += 1;
  } else if (Math.random() < 0.30) {
    p.pop = Math.max(0, p.pop - 0.1);
  }
  return { team, opp, win };
}

/* ------------------------------ FMVP ----------------------------------- */
function teammateAvgs(p, year, nGames) {
  const base = p.teamNpc(year); const res = [];
  for (let i = 0; i < 4; i++) { let s = 0; for (let g = 0; g < nGames; g++) s += base + rnd(-12, 15); res.push(s / nGames); }
  return res;
}
function checkFMVP(p, year, fList) {
  if (!fList.length) return { won: false };
  const avg = fList.reduce((a, b) => a + b, 0) / fList.length;
  if (avg < CONFIG.FMVP_F_MIN) return { won: false, avg, reason: "low" };
  const mates = teammateAvgs(p, year, fList.length);
  if (!mates.every(t => avg >= t)) return { won: false, avg, reason: "mate" };
  const pVote = clamp(0.50 + (avg - 90) * 0.02, 0.30, 0.70);
  return { won: Math.random() < pVote, avg, reason: "vote", p: pVote };
}

/* --------------------------- 结算辅助 ---------------------------------- */
function settleChamp(p, kind, year, fmvp) {
  const [popR, moneyR] = CONFIG.CHAMP_REWARD[kind];
  p.addPop(popR); p.money += moneyR; p.champ[kind] += 1;
  p.champ_per_year[year] = (p.champ_per_year[year] || 0) + 1;
  if (p.first_champ_year === null) p.first_champ_year = year;
  if (p.teno_active) p.won_with_teno = true;
  if (fmvp) {
    p.fmvp_total += 1; p.fmvp_per_year[year] = (p.fmvp_per_year[year] || 0) + 1;
    p.addPop(CONFIG.FMVP_REWARD[0]); p.money += CONFIG.FMVP_REWARD[1];
  }
  p.fmvp_seq.push(!!fmvp);
}
function settleRunnerup(p, kind) { p.runnerups += 1; p.addPop(CONFIG.RUNNERUP_POP); p.money += CONFIG.CHAMP_REWARD[kind][1] / 3; }
function settleThird(p, kind) { p.thirds += 1; p.addPop(CONFIG.THIRD_POP); p.money += CONFIG.CHAMP_REWARD[kind][1] / 6; }
function maxRunTrue(seq) { let best = 0, cur = 0; for (const v of seq) { cur = v ? cur + 1 : 0; best = Math.max(best, cur); } return best; }

/* ----------------------- 半途特殊结局门槛 ------------------------------ */
function specialTriggers(p, year) {
  const s = [];
  const noChamp = p.totalChamp === 0;
  if (p.appearance > 75 && p.pop >= 70 && p.tech < 60 && noChamp && p.ev_count >= 5) s.push("签约艺人");
  if (p.appearance > 80 && p.ev_count > 10 && p.pop >= 55) s.push("短剧演员");
  if (year > 3 && p.tac >= 80 && (p.tac - p.tech) >= 10 && p.pop >= 120) s.push("转行解说");
  if (year >= 5 && p.tac >= 90 && p.tech >= 80 && p.stab >= 85 && p.champ["深渊"] === 0 && (p.champ["夏"] + p.champ["秋"]) >= 1) s.push("转行教练");
  if (year >= 5 && p.money >= 50000 && p.pop >= 200) s.push("校长好");
  return s;
}

/* ------------------------- 商业休整解锁判定 ---------------------------- */
function commercialRestEligible(p) {
  const noChamp = p.totalChamp === 0;
  const cond1 = p.pop >= 100 && p.appearance >= 70 && p.ev_count >= 5;
  const cond2 = p.tech < 60 && noChamp;
  return cond1 || cond2;
}

/* ------------------------------ 转会 ----------------------------------- */
// 返回转会窗口发生的事件列表(用于展示)；玩家可在被征求意见时选择是否接受。
function transferRollForced(p) {  // 是否触发"可能转会"
  const pmove = p.pop >= 150 ? CONFIG.TRANSFER_P_HIGH : CONFIG.TRANSFER_P_BASE;
  if (Math.random() >= pmove) return null;
  return p.recent_perf < CONFIG.TRANSFER_PERF_SELL ? "sell" : "offer";
}
function doTransfer(p) {
  p.transfer_count += 1;
  const bias = (p.luck > 60 || p.pop > 100) ? 1.0 : -1.0;
  p.npc_offset += rnd(-5, 8) * (bias > 0 ? 1.0 : 0.6);
}
function transferAmbient(p) {  // 队友进出 + 其他战队扰动
  const ev = [];
  if (Math.random() < CONFIG.TEAMMATE_IN_P) { const d = rnd(0, 5); p.npc_offset += d; ev.push({ t: "in", d }); }
  if (Math.random() < CONFIG.TEAMMATE_OUT_P) { const d = rnd(-5, 0); p.npc_offset += d; ev.push({ t: "out", d }); }
  p.opp_delta_extra = Math.random() < CONFIG.OTHER_TEAM_P ? rnd(-2, 2) : 0;
  return ev;
}

/* ---------------------------- 年度评选 --------------------------------- */
function annualAwards(p, year) {
  const out = { best: false, popular: false, avg: 0 };
  if (p.year_f.length) {
    const avg = p.year_f.reduce((a, b) => a + b, 0) / p.year_f.length;
    out.avg = avg;
    let bestNpc = -1e9;
    for (let i = 0; i < 49; i++) bestNpc = Math.max(bestNpc, gauss(62 + oppDelta(year), 6));
    if (avg >= CONFIG.BEST_PERF_F_MIN && avg >= bestNpc &&
        Math.random() < clamp(0.50 + (avg - 88) * 0.02, 0.30, 0.70)) {
      p.best_perf_count += 1; out.best = true;
    }
  }
  if (p.pop >= popThr3(year)) { p.popular_count += 1; out.popular = true; }
  p.last_award = out;
  return out;
}

/* ------------------------------ 赛后因果解释 reasonTags ----------------- */
// ctx: {stage, win, keyMatch, F, opp, team, cheer, fainted, year, age}
function reasonTags(p, ctx) {
  const tags = [];
  const survRef = { "常规": 55, "季后": 72, "IVS": 78, "预选": 56, "小组": 68, "总决": 78 }[ctx.stage] || 60;
  if (ctx.win) {
    if (p.teno_active || p.temp_active) tags.push("injured_win");
    if (ctx.cheer >= 3) tags.push("high_pop_support");
    if (p.nextGameBuffUsed) tags.push("item_buff");
    if (p.tech >= survRef + 8) tags.push("tech_adv");
    else if (p.tac >= survRef + 8) tags.push("tac_adv");
    else if (p.stab >= 70 && ctx.keyMatch) tags.push("stab_adv");
    if (p.teamNpc(ctx.year) >= 66) tags.push("teammate_strong");
    if (ctx.year === 1 && ctx.stage === "常规") tags.push("rookie_protect");
  } else {
    if (ctx.fainted || p.stamina < 20) tags.push("low_stamina");
    if (p.teno_active) tags.push("injury_teno");
    else if (p.temp_active) tags.push("injury_temp");
    if (p.negative_news) tags.push("negative_news");
    if (p._abyss_fatigue > 0) tags.push("sync_fatigue");
    if (p.tech < survRef - 8) tags.push("tech_low");
    else if (p.tac < survRef - 8) tags.push("tac_low");
    else if (p.phys < survRef - 12) tags.push("phys_low");
    else if (p.stab < 50 && ctx.keyMatch) tags.push("stab_low");
    if (ctx.opp >= survRef + 10 || ctx.keyMatch) tags.push("opponent_strong");
    if (p.teamNpc(ctx.year) <= 55) tags.push("teammate_weak");
    if (ctx.age >= 22) tags.push("age_decay");
  }
  return tags;
}

/* ------------------------- 成就 / 最终结局 ----------------------------- */
function computeAchievements(p, fullCareer, grandSlam, forced) {
  const a = {};
  const total = p.totalChamp;
  const nonIvs = p.champ["夏"] + p.champ["秋"] + p.champ["深渊"];
  const survivor = (p.role === "求生者");
  const allround = (p.tech >= 80 && p.tac >= 80 && p.phys >= 80 && p.stab >= 80);

  a["金满贯"] = !!grandSlam;
  a["大满贯"] = (p.champ["夏"] >= 1 && p.champ["秋"] >= 1 && p.champ["深渊"] >= 1);
  a["洲际之巅"] = (p.champ["IVS"] >= 1);
  a["冠军选手"] = (nonIvs >= 1);
  a["FMVP"] = (p.fmvp_total >= 1);
  a["专属王朝"] = (maxRunTrue(p.fmvp_seq) >= 2);
  a["电竞白月光"] = (p.pop >= 300);
  a["全能选手"] = allround;
  a["操作手"] = a["战队大脑"] = false;
  if (survivor && !allround) {
    const op = p.tech >= 90, br = p.tac >= 90;
    if (op && br) { if (p.tech >= p.tac) a["操作手"] = true; else a["战队大脑"] = true; }
    else if (op) a["操作手"] = true;
    else if (br) a["战队大脑"] = true;
  }
  a["光荣的荆棘路"] = (p.first_year_failed && p.ever_starter && total >= 1);
  a["年度最佳演绎"] = (p.best_perf_count >= 1);
  a["看台上的星海"] = (p.pop >= 250 && p.popular_count >= 3 && fullCareer);
  a["一人一城"] = (fullCareer && p.transfer_count === 0 && total >= 1);
  a["大器晚成"] = (p.first_champ_year === 6 || p.first_champ_year === 7);
  a["浴血荣光"] = (p.won_with_teno && fullCareer);
  const champYears = Object.keys(p.champ_per_year).map(Number).filter(y => p.champ_per_year[y] > 0);
  const lcy = champYears.length ? Math.max(...champYears) : 0;
  a["昙花"] = (fullCareer && lcy > 0 && lcy < CONFIG.YEARS &&
               ((p.fmvp_per_year[lcy] || 0) >= 1 || (p.champ_per_year[lcy] || 0) >= 2));
  a["天妒英才"] = (p.tech >= 95 && (p.teno_count - 1) >= 2 && forced === "伤重退役" && p.champ["深渊"] === 0);
  a["遗珠"] = (allround && total === 0 && p.pop <= 80);
  a["百炼成钢"] = ((p.ever_negative || p.ever_injured || p.ever_fail) && p.stab >= 100);
  a["浪迹天涯"] = (p.transfer_count >= 3);
  a["轻伤不下火线"] = (p.injured_win >= 10);
  a["流量为王"] = (total === 0 && p.pop >= 130);
  a["老大"] = (p.pop >= 800 && p.money >= 100000 && total >= 5 && p.fmvp_total >= 2);
  return a;
}

function finalEnding(p, fullCareer, grandSlam, forced, ach) {
  if (forced) return forced;
  const total = p.totalChamp;
  const dynasty = ach["专属王朝"], bigSlam = ach["大满贯"];
  if (grandSlam && ach["看台上的星海"] && ach["年度最佳演绎"]) return "时代丰碑";
  if (bigSlam && ach["年度最佳演绎"]) return "黄金之路";
  if (ach["大器晚成"] && ach["浴血荣光"] && ach["百炼成钢"]) return "终章封王";
  if (ach["看台上的星海"] && ach["洲际之巅"] && ach["冠军选手"] && ach["全能选手"]) return "国民选手";
  if (dynasty) return "专属王朝";
  if (total >= 1) return "金雨之下";
  if (total === 0 && (p.runnerups + p.thirds) >= 5 && p.tech >= 85 && p.tac >= 85) return "无冕之王";
  if (fullCareer && p.stab >= 80 && p.playoff_count >= 6) return "可靠老将";
  if (fullCareer && p.playoff_count >= 6 && total <= 2) return "常青绿叶";
  if (fullCareer && p.pop >= 80 && total <= 2) return "联盟熟面孔";
  if (p.pop < 30 && p.money < 5000) return "隐入人海";
  if (total === 0 && p.pop < 50) return "黯然退役";
  return "断开链接";
}

/* ----------------------- 结局 / 成就 文案库 ---------------------------- */
const ENDING_TEXT = {
  // 特殊结局（文案设计 v1.1 §十三.1）
  "饮水机管理员": "长江后浪推前浪，电子竞技最不缺新鲜血液，漫长的备战间生涯消磨了你的青春与斗志。",
  "你被开除了！": "职业道德比技术更重要，未成年红线碰不得。",
  "伤重退役": "片子拍了很多张，结论一次比一次沉重。你收起诊断书，没有再多说什么。你最后看了一眼那把陪你打了多年的电竞椅——这场告别，不是主动的选择，是身体替你做了决定。",
  "签约艺人": "你的赛场表现不尽如人意，但你的外形与节目效果又弥补了这一点。",
  "短剧演员": "不想跳上车舞的电竞选手不是好短剧演员。",
  "转行解说": "你站在了新的聚光灯下，用丰富的赛场经验贡献了一场场精彩的解说，也见证着一场场金雨落下。",
  "转行教练": "你没有离开热爱的赛场，选择继续陪伴追梦的少年一路成长，如同凝视少年的自己。",
  "校长好": "你开办了自己的电竞学校，为赛场源源不断地输送人才，在 IVL 界也是一段佳话。",
  "老大": "冠军、票子、名气都有了，你在光环里渐渐迷失了自己，看谁都不顺眼，索性过起了大门不出二门不迈的躺平生活。",
  // 最终结局（文案设计 v1.1 §十三.4，优先级 1→13）
  "时代丰碑": "这个时代以你命名。",
  "黄金之路": "那些场金色的雨，为你铺就金色的路。",
  "终章封王": "少年不负凌云志，跋山涉水赴顶峰。",
  "国民选手": "新人模仿你的操作，老粉守着你的退役，对手敬你的人品。",
  "专属王朝": "连续两届 FMVP，你是赛场上无可置疑的统治者。",
  "金雨之下": "金雨落下的那一刻，这座冠军奖杯属于你。",
  "无冕之王": "就算没有那顶王冠，你的实力也为世人所认可。",
  "可靠老将": "年轻人换了一茬又一茬，而你始终是队伍里的定海神针。",
  "常青绿叶": "主角光环没落在你身上，可这片舞台少了你就不完整。",
  "联盟熟面孔": "只要你还在打，老观众就还在看。",
  "隐入人海": "退役那天，你卸载了游戏，像一滴水，悄无声息地汇进了大海。",
  "黯然退役": "你或许没有冠军，连告别都办得悄无声息。但你知道，你曾经真切地站上过那片赛场。",
  "断开链接": "感谢你成为「玩家ID」，祝你三次顺利！",
};

const ACH_DESC = {
  "金满贯": "同一年内夺得夏/秋/IVS/深渊四冠",
  "大满贯": "夏/秋/深渊冠军各至少 1 次",
  "洲际之巅": "IVS 冠军 ≥1",
  "冠军选手": "任意赛事（除 IVS）冠军 ≥1",
  "FMVP": "当选 FMVP ≥1",
  "专属王朝": "连续 2 次当选 FMVP",
  "电竞白月光": "人气 ≥300 万",
  "操作手": "求生者·技术 ≥90（与全能互斥）",
  "战队大脑": "求生者·战术 ≥90（与全能互斥）",
  "全能选手": "技/战/体/稳 均 ≥80",
  "光荣的荆棘路": "首年选拔曾失败，后转正并夺冠",
  "年度最佳演绎": "当选年度最佳演绎 ≥1",
  "看台上的星海": "满役·人气≥250·3 度年度人气选手",
  "一人一城": "满役·从未转会·至少 1 冠",
  "大器晚成": "首冠出现在第 6 或第 7 赛年",
  "浴血荣光": "满役·带腱鞘炎夺冠",
  "昙花": "满役·末冠年高光后再未夺冠",
  "天妒英才": "技术≥95·腱鞘炎复发≥2·伤重退役·无全球冠",
  "遗珠": "全能·0 冠·人气 ≤80",
  "百炼成钢": "曾遭舆论/伤病/落选·稳定性练满 100",
  "浪迹天涯": "生涯转会 ≥3 次",
  "轻伤不下火线": "带伤取胜 ≥10 场",
  "流量为王": "全生涯 0 冠却人气 ≥130 万（隐藏）",
  "老大": "人气≥800·资金≥10万·冠军≥5·FMVP≥2（究极隐藏）",
};

/* ---------------- 赛后因果解释·文案池(feedback15) --------------------- */
const REASON_TEXT = {
  // 个人能力类
  tech_adv: ["你靠一波近乎本能的操作打开了局面，场馆里的声音在那一刻炸开。", "碾压式的胜利。", "当所有人都以为凶多吉少的时候，你精彩的操作挽回了局面。"],
  tac_adv: ["你没有急着证明自己，而是一点点把对手逼进了最难受的位置。", "这一场赢得不吵闹，却很扎实。每一次转点、每一次拉扯，都像提前算好的一样。", "对手以为还能拖，你却已经把最后的退路封死了。"],
  stab_adv: ["越到最后，你反而越安静。别人开始变形的时候，你还在按自己的节奏打。", "加时赛拖得很长，但你的手没有抖。", "你把所有声音都关在耳机外，只留下眼前这一局。"],
  high_pop_support: ["台下粉丝为你举起的灯牌汇成了一片应援海，也为电竞椅上的你注入了能量。", "你听见有人喊你的 ID。那一刻，你突然觉得自己还能再多撑一局。", "这座场馆今晚站在你身后，你没有辜负他们。"],
  item_buff: ["你说不清这是运气，还是准备终于等来了回报。但那几个关键选择，确实都站在了你这边。", "赛前准备没有白费。对手刚露出习惯动作，你就已经知道下一步该怎么处理。", "赛前的补给救了你一命，至少在最后一局，你还有力气把手抬起来。", "那些专属于你的应援物料铺满了看台，也把这一场变成了你的主场。"],
  injured_win: ["观众看见的是带伤坚持，只有你知道每一次拉扯有多疼。", "你当然知道该怎么打，这一次，连身体也陪你赢了一回。", "带着伤把这场拿下来，比任何一场都更像一座奖杯。"],
  teammate_strong: ["这一次，不是你一个人在扛。队友们把你没能处理好的地方一点点补了回来。", "新来的队友很快接住了节奏，你们第一次像真正的整体。", "你没有打出最亮眼的一场，但队伍替你守住了胜利。"],
  rookie_protect: ["联盟还没有完全看清你的打法，而你抓住了这段最宝贵的新秀窗口。", "没人真正研究过你，这反而成了你第一年的武器。", "初登赛场的青涩没有拖住你，反而让对手低估了你的锋芒。"],

  tech_low: ["你的操作已经足够努力，但细节还是差了一点。", "那一波本可以成为翻盘点，可你的操作速没能跟上思路。", "对面的节奏压得太紧，你几次想靠操作撕开口子都没能成功。"],
  tac_low: ["你看见了机会，却没能看见机会背后的风险。", "对手把比赛拖进了他们熟悉的节奏，你看着胜利在手中溜走，却无能为力。", "这一场不是输在手上，而是输在对局势的判断。"],
  phys_low: ["你不是不会打，而是身体已经跟不上这场漫长的消耗战。", "前几局你还能咬住，可越到后面，呼吸和手臂都开始变得沉重。", "这个赛季你把太多时间留给了技术训练，却没给身体留下足够的余地。"],
  stab_low: ["决胜局的灯光太亮，耳机里的呼吸声也变得格外清楚，你没能像平时那样稳住。", "你不是没有机会，只是在最需要冷静的那一刻，心跳盖过了判断。", "场馆越安静，你越能听见自己的紧张。"],
  low_stamina: ["漫长的赛程榨干了你最后一点力气，关键回合里，你的手慢了半拍。", "你靠意志撑到了最后，但身体已经不肯再听指挥。", "这一场不是不想赢，是你真的已经没有力气再赢下去了。"],
  injury_teno: ["你的手伤让你无法发挥出全部的实力，每一次拉扯都像在和疼痛一起比赛。", "你当然知道该怎么打，只是手腕没有给你同样的答案。", "观众看见的是失误，只有你知道那一下疼得有多突然。"],
  injury_temp: ["肩颈的酸痛让你很难长时间保持专注，每一次转头沟通都像在提醒你该休息了。", "屏幕上的光变得刺眼，你仍然盯着每一个细节，却很难像平时那样敏锐。", "你的手腕在每一次操作后都隐隐作痛，连最熟悉的动作都变得不那么顺手。"],
  negative_news: ["场外的声音没有真的离开。每一次失误，都像会被放大成新的嘲笑。", "你努力把那些争议关在比赛之外，可它们还是从缝隙里钻进了你的脑子。", "这一场你不只是在和对手比赛，也在和舆论留下的阴影比赛。"],
  sync_fatigue: ["你已经赢了太多比赛，也为此付出了太多体力。深渊还没开始，疲惫就已经坐在了你身边。", "所有人都在期待金满贯，可只有你知道，前三座奖杯有多重。", "这一年太辉煌，也太漫长。你带着冠军的光环走进深渊，也带着一身没来得及恢复的疲惫。"],
  opponent_strong: ["你已经打得足够好了，只是对面今天几乎没有给出任何破绽。", "这不是一场轻易能跨过去的比赛。对手站在你面前，就像一堵准备了整个赛季的墙。", "你把能做的都做了，但世界赛的舞台从来不会因为努力就降低难度。"],
  teammate_weak: ["你已经尽力把局面往回拉，但队伍的其他环节没有跟上。", "这支新队伍还没有真正磨合起来，你们像五个人在打五场不同的比赛。", "有些失误不是你一个人能补回来的。"],
  age_decay: ["年轻时欠下的训练账，到了生涯后半段开始变得难还。", "你仍然努力，只是身体和时间不再像刚出道时那样慷慨。", "有些差距不是一场训练能补回来的，它们来自整个职业生涯的选择。"],
};
// reasonTags 主因优先级(取第一个命中的)
const REASON_PRIORITY_WIN = ["injured_win", "tech_adv", "tac_adv", "stab_adv", "high_pop_support", "item_buff", "teammate_strong", "rookie_protect"];
const REASON_PRIORITY_LOSE = ["low_stamina", "injury_teno", "injury_temp", "negative_news", "sync_fatigue", "stab_low", "tech_low", "tac_low", "phys_low", "opponent_strong", "teammate_weak", "age_decay"];

function pickReason(tags, win) {
  const order = win ? REASON_PRIORITY_WIN : REASON_PRIORITY_LOSE;
  for (const t of order) { if (tags.includes(t) && REASON_TEXT[t]) return choiceOf(REASON_TEXT[t]); }
  return null;
}

/* --------------------------- 训练期事件(19 件) ------------------------ *
 * feedback15: options 只给"做什么"的措辞, 不预显任何数值; 结果在选完后由 apply() 公布。
 * apply(p) -> 结果文案(string)。私联粉丝赴约可能置 p._fired=true。
 * --------------------------------------------------------------------- */
const TRAIN_EVENTS = {
  "电竞节": { flavor: "你所在的战队收到了电竞节的邀约！战队经理正在就是否参加征求队员们的意见，你选择——", options: [
    { label: "参加", apply(p){ p.grow("tech",3); p.grow("tac",3); p.money+=500; p.stamina-=25; return "你在台上和高手过招，也偷师了几手版本理解。技术/战术各 +3，资金 +500，体力 −25。"; } },
    { label: "不参加", apply(p){ p.stamina+=20; return "你窝在基地养精蓄锐。体力 +20。"; } } ] },
  "漫展邀约": { flavor: "你收到了漫展的邀请，你选择——", options: [
    { label: "欣然前往", apply(p){ p.addPop(1.5); p.money+=300; p.stamina-=15; p.ev_count++; return "现场尖叫不断，人气大涨。人气 +1.5（×外貌），资金 +300，体力 −15。"; } },
    { label: "专注训练", apply(p){ p.grow("tech",2); p.grow("phys",2); return "你婉拒了邀约，留在训练室。技术/体能各 +2。"; } } ] },
  "节目录制": { flavor: "一档热门综艺向你发来录制邀请，曝光量拉满，就是得占掉几天训练时间。你选择——", options: [
    { label: "应邀参加", apply(p){ p.addPop(1.5); p.stamina-=15; p.ev_count++; return "节目效果拉满，路人缘 +++。人气 +1.5（×外貌），体力 −15。"; } },
    { label: "婉拒", apply(p){ p.stamina+=10; return "你选择低调。体力 +10。"; } } ] },
  "商务邀约": { flavor: "你收到了品牌方的商务邀请！但忙碌的个人行程会导致你缺席一段时间的训练，你选择——", options: [
    { label: "接受", apply(p){ p.money+=1200; p.tech=Math.max(0,p.tech-2); p.stamina-=15; p.ev_count++; return "拍摄占用了不少训练时间。资金 +1200，技术 −2，体力 −15。"; } },
    { label: "专注训练", apply(p){ p.grow("tech",2); p.grow("tac",2); return "钱再赚，状态要紧。技术/战术各 +2。"; } } ] },
  "网络舆论": { flavor: "深夜刷手机时，你看到网络上有你的舆论风波，你选择——", options: [
    { label: "气不过，与黑子对喷", apply(p){ p.stamina+=5; p.grow("stab",2); p.addPop(-2); return "你骂得酣畅，气是出了，却也掉了点粉。体力 +5，稳定 +2，人气 −2。"; } },
    { label: "交给俱乐部处理", apply(p){ p.grow("stab",2); p.money-=300; return "公关团队出手平息。稳定 +2，资金 −300。"; } } ] },
  "老子才是老大": { flavor: "队友赛前人间蒸发，只留下一段神秘小作文。而队内的替补成员技术尚不稳定，你选择——", options: [
    { label: "主动抗压，熬夜练习新角色", apply(p){ p.grow("tech",4); p.addPop(1); p.stamina-=30; return "你用通宵苦练扛起核心。技术 +4，人气 +1，体力 −30。"; } },
    { label: "与新队员复盘对局，帮助他快速进步", apply(p){ p.grow("tac",4); p.grow("stab",2); p.stamina-=15; return "一场深夜复盘让全队拧成一股绳。战术 +4，稳定 +2，体力 −15。"; } },
    { label: "这谁能忍！开小号在网上狂喷这个没担当的队友", apply(p){ p.stamina+=5; if(Math.random()<0.25){ p.addPop(-5); p.stab=Math.max(0,p.stab-4); p.ever_negative=true; return "小号被扒了个底朝天，翻车。体力 +5，人气 −5，稳定 −4。"; } return "你偷偷发泄了一通，没被发现。体力 +5。"; } } ] },
  "不速之客": { flavor: "一只广东双马尾以迅雷不及掩耳之势在训练室的地板上流窜——", options: [
    { label: "你携带了\u201c膝跳反射\u201d，弹射离开座位", apply(p){ p.grow("tac",2); p.grow("phys",2); return "一个箭步溜得飞快。战术/体能各 +2。"; } },
    { label: "你携带了\u201c化险为夷\u201d，淡定地用拖鞋拍向小强", apply(p){ p.grow("stab",4); return "你沉着应对，一击毙敌。稳定 +4。"; } } ] },
  "浴室惊魂": { flavor: "咣当！你在洗澡时一不小心没站稳，摔倒在浴室，左侧耻骨传来剧痛，你选择——", options: [
    { label: "我是个体面人，坚持穿好衣服爬出浴室求救", apply(p){ p.phys=Math.max(0,p.phys-3); p.stamina-=15; return "你忍痛穿戴整齐才呼救，所幸无大碍。体能 −3，体力 −15。"; } },
    { label: "管不了那么多了，赶紧来个人帮帮我！", apply(p){ p.stamina-=10; return "队友冲进来把你扶了出去。体力 −10。"; } } ] },
  "老板跑路": { flavor: "俱乐部换了新老板，但交接出现重大问题导致资金断流，工资发不出来，连菜钱都要阿姨垫付，你选择——", options: [
    { label: "多接代打单子，日子总要过下去", apply(p){ p.grow("tech",3); p.grow("stab",2); return "你靠代打补贴，也练了手。技术 +3，稳定 +2。"; } },
    { label: "专心训练，决心在比赛中打出风采", apply(p){ p.grow("tech",3); p.grow("tac",3); return "风浪越大鱼越贵，你选择沉住气。技术/战术各 +3。"; } } ] },
  "版本答案": { flavor: "最近一连出了几个吃操作的新角色，繁重的练习让你感到非常疲惫，你选择——", options: [
    { label: "咬牙坚持，一定要啃下这块硬骨头", apply(p){ p.grow("tech",5); p.phys=Math.max(0,p.phys-4); p.stamina-=30; return "你把新套路肝穿了。技术 +5，体能 −4，体力 −30。"; } },
    { label: "索性摆烂，状态才是最重要的", apply(p){ p.grow("stab",3); p.stamina+=15; p.addPop(-2); return "你选择保状态，被嘲不思进取。稳定 +3，体力 +15，人气 −2。"; } } ] },
  "手机风波": { flavor: "训练室里出现了无人认领的手机！你选择——", options: [
    { label: "交给经验丰富的经理处理", apply(p){ p.grow("stab",3); return "经理稳妥处理，化解尴尬。稳定 +3。"; } },
    { label: "先收起来，赛后问问其他队伍", apply(p){ p.stab=Math.max(0,p.stab-4); return "之后，这支队伍在网上造谣你们偷看了训练机里的赛训，虽然最终真相大白，你还是受到了不小的影响。稳定 −4。"; } } ] },
  "私联粉丝": { flavor: "一位\u201c粉丝\u201d频繁私信向你表达好感，还约你私下出来见一面。糖衣炮弹，也是职业生涯的一道考题——你选择：", options: [
    { label: "坚守职业道德，婉拒邀约", apply(p){ if(Math.random()<0.10){ p.addPop(3); return "你客气而坚决地回绝了。这事被对方截图发了出去，\u201c洁身自好\u201d反倒成了一段佳话，路人缘涨了一截。人气 +3。"; } return "你客气而坚决地回绝了。无事发生。"; } },
    { label: "心动赴约，私下见面", apply(p){
        const minor=Math.random()<0.50, exposed=Math.random()<0.45;
        if(minor&&exposed){ p._fired=true; return "对方竟是未成年人，照片和聊天记录被扒了个底朝天。俱乐部连夜开了发布会，与你解约。——【你被开除了！】"; }
        if(!minor&&exposed){ p.addPop(-8); p.stab=Math.max(0,p.stab-5); p.negative_news=true; p.ever_negative=true; return "照片第二天就挂上了热搜，\u201c职业选手私会粉丝\u201d的词条压了一整天，俱乐部的脸色很难看。人气 −8，稳定 −5，叠加负面新闻。"; }
        if(minor){ p.grow("stab",3); return "聊了几句你才惊觉对方还是个高中生，借口匆匆离场。这次，是真的踩在红线边上了。稳定 +3。"; }
        p.grow("stab",3); return "虚惊一场。回去的路上你后怕了好一阵——这种事，下不为例。稳定 +3。"; } } ] },
  "传奇前辈指点": { flavor: "一位早已退役的名宿路过基地，进训练室和你们唠了几句。机会难得，你选择——", options: [
    { label: "虚心请教运营心得", apply(p){ p.grow("tac",3); p.grow("stab",2); p.stamina-=15; return "老前辈把当年那套读秒、转点、卡视野的运营思路掰开揉碎讲给你听，你听得入了神。战术 +3，稳定 +2，体力 −15。"; } },
    { label: "不服气提出单挑切磋", apply(p){ p.grow("tech",3); p.stab=Math.max(0,p.stab-2); return "你被\u201c退役老登\u201d按在板区摩擦，但那几手意识确实让你长了记性。技术 +3，稳定 −2。"; } } ] },
  "短视频爆火": { flavor: "你的一条手势舞短视频在社交平台爆火，连不玩游戏的同学都来问你是不是成网红了。此时你选择——", options: [
    { label: "趁热打铁，加更涨粉", apply(p){ p.addPop(4); p.tech=Math.max(0,p.tech-2); p.stamina-=15; return "你连更了好几条，热度肉眼可见地往上窜，代价是训练时间被压得只剩个零头。人气 +4，技术 −2，体力 −15。"; } },
    { label: "不被打扰，专注训练", apply(p){ p.grow("tech",2); p.grow("tac",2); return "你把热搜静音，一头扎回训练室。流量会过去，但赛场上的东西不骗人。技术/战术各 +2。"; } } ] },
  "战队团建": { flavor: "俱乐部组织了一次线下团建，KTV、剧本杀、烧烤一条龙。难得不用对着屏幕的一天，你选择——", options: [
    { label: "积极参加增进默契", apply(p){ p.grow("tac",3); p.grow("stab",2); p.stamina-=15; return "一晚上闹下来，几个平时只在语音里见的队友关系近了不少。战术 +3，稳定 +2，体力 −15。"; } },
    { label: "借机在房间休整", apply(p){ p.stamina+=40; return "你跟经理报备后回房补觉，睡了个天昏地暗。身体是革命的本钱。体力大幅恢复。"; } } ] },
  "训练瓶颈期": { flavor: "最近怎么练都不见长，复盘时甚至觉得自己越打越回去了。瓶颈期像一堵墙横在面前，你选择——", options: [
    { label: "换思路针对性加练", apply(p){ p.grow("tech",3); p.grow("tac",3); p.stamina-=30; return "你和教练翻了几十局录像，揪出几个反复犯的小毛病一遍遍抠。很累，但那堵墙松动了。技术/战术各 +3，体力 −30。"; } },
    { label: "暂时放空调整心态", apply(p){ p.grow("stab",3); p.stamina+=15; return "你给自己放了半天假，回来时那股拧巴劲儿松开了一些。稳定 +3，体力 +15。"; } } ] },
  "家人探班": { flavor: "爸妈大老远跑来基地看你，手里还拎着家乡的特产。看着他们鬓角的白发，你选择——", options: [
    { label: "陪伴家人放松一天", apply(p){ p.grow("stab",3); p.stamina+=15; p.tech=Math.max(0,p.tech-2); return "你请了一天假，陪他们逛了逛、吃了顿好的。稳定 +3，体力 +15，技术 −2。"; } },
    { label: "婉拒继续训练", apply(p){ p.grow("tech",2); p.stab=Math.max(0,p.stab-1); return "你抱了抱他们，又转身回了训练室。\u201c等我打出成绩，再好好陪你们。\u201d技术 +2，稳定 −1。"; } } ] },
  "体检预警": { flavor: "年度体检报告出来了，几项指标亮起红灯，队医建议你立刻调整作息、降低强度。你选择——", options: [
    { label: "遵医嘱调整作息", apply(p){ p.grow("phys",3); p.grow("stab",2); p.stamina-=15; return "你开始按表作息、补练体能。训练量降了点，但身体明显轻快了。体能 +3，稳定 +2，体力 −15。"; } },
    { label: "硬扛维持高强度", apply(p){ p.grow("tech",3); p.phys=Math.max(0,p.phys-3); p.inj_train_mult=1.5; return "比赛在即，你把报告塞进抽屉照旧连轴转。技术 +3，体能 −3——本训练周期受伤概率升高。"; } } ] },
  "直播口嗨翻车": { flavor: "直播时你一句口嗨被掐头去尾截成图，配上耸动标题传遍全网，评论区已经吵翻了天。你选择——", options: [
    { label: "诚恳道歉灭火", apply(p){ p.addPop(-3); p.grow("stab",3); return "你第一时间发了条澄清加道歉，姿态放得很低，但依旧有人不买账。人气 −3，稳定 +3。"; } },
    { label: "嘴硬对线", apply(p){ p.stamina+=5; if(Math.random()<0.30){ p.addPop(-5); p.stab=Math.max(0,p.stab-4); p.negative_news=true; p.ever_negative=true; return "你直接开麦回怼，痛快是痛快，却被大主播一转发\u201c挂人\u201d闹大了。人气 −5，稳定 −4，叠加负面新闻。"; } return "你偏不认怂，直接开麦回怼，风波居然自己平息了。体力 +5。"; } } ] },
};
const TRAIN_EVENT_KEYS = Object.keys(TRAIN_EVENTS);

/* ---------------------- FMVP 颁奖词（文案设计 v1.1 §七·通用兜底池） ----- *
 * 正文随机取 1 条，后接固定结尾句：
 * 恭喜 {战队}_{ID} 荣获 {年份}{赛事名称}总决赛 FMVP！
 * --------------------------------------------------------------------- */
const FMVP_SPEECHES = [
  "金雨倾城，星河入袖；少年提剑，自此封侯。",
  "风起于微末，名成于终局；今夜灯如昼，皆为少年明。",
  "千淘万漉虽辛苦，吹尽狂沙始到金。",
  "以热爱为刃，以坚持为甲；终在金雨之下，加冕封王。",
  "灯火为你而亮，欢呼为你而起；少年不负凌云，巅峰终有其名。",
  "一程风雨一程歌，今朝登顶震山河。",
  "灯乍亮，鼓方停，一身锋芒映汗星；且看金雨倾肩处，少年自此万人擎。",
  "风未歇，剑已鸣，孤光独刺夜深沉；待到尘埃落定日，满城争诵此时名。",
  "一剑曾经沧海冷，今朝出鞘动雷霆。",
  "蓄势三冬方破雪，凌寒一枝独占春。",
  "不啻微茫终汇炬，纵经长夜亦逢明。",
  "山高自有登顶者，海阔甘为破浪人。",
  "以热血浇铸冠冕，借星光照亮归途。",
  "少年自有拏云志，如今乘风上九霄。",
  "少年提灯赴长夜，归来已是顶峰人。",
];

/* --------------------------- 暴露到全局 -------------------------------- */
window.IVL = {
  CONFIG, SHOP_ITEMS, Player, rnd, randint, triangular, gauss, clamp, choiceOf,
  OPP_POP: CONFIG.OPP_POP, WIN_POP: CONFIG.WIN_POP, CHAMP_REWARD: CONFIG.CHAMP_REWARD,
  selectThreshold, npcSelf, growthTech, growthTac, growthPhys, oppDelta, sampleOpp, popThr3,
  applyTraining, tenoProb, rollInjury, healInjury, endCompetition,
  matchStartStamina, gameCost, luckCheck, rollMatchEvent, computeF, settleGame,
  teammateAvgs, checkFMVP, settleChamp, settleRunnerup, settleThird, maxRunTrue,
  specialTriggers, commercialRestEligible, transferRollForced, doTransfer, transferAmbient,
  annualAwards, reasonTags, pickReason,
  computeAchievements, finalEnding, ENDING_TEXT, ACH_DESC, REASON_TEXT,
  TRAIN_EVENTS, TRAIN_EVENT_KEYS, FMVP_SPEECHES,
};

