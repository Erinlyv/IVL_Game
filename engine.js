/* =============================================================================
 * IVL 模拟器 · 引擎 (engine.js)
 * 严格移植自《测试脚本/montecarlo_ivl.py》(对齐《测试版 v1.2》)。
 * 唯一区别：把脚本里的"策略自动决策"替换为玩家点击 —— 数值/公式逐项保持一致，
 * 以便 demo 的手感与已验证的平衡保持同源。
 *
 * 这里只放"纯逻辑/数据"（无 DOM）。交互编排在 game.js。
 * ===========================================================================*/

/* ----------------------------- 随机数工具 ------------------------------ */
function rnd(a, b) { return a + Math.random() * (b - a); }              // U[a,b]
function randint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function triangular(low, high, mode) {                                  // Tri(下限,上限,众数)
  const u = Math.random();
  const c = (mode - low) / (high - low);
  if (u < c) return low + Math.sqrt(u * (high - low) * (mode - low));
  return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ------------------------------- CONFIG -------------------------------- */
const CONFIG = {
  YEARS: 7,
  START_AGE: 18,

  // 训练项目(正常强度基准): tech, tac, phys, stab, pop, cost(体力消耗)
  TRAIN: {
    "单练":   { tech: 2, tac: 0, phys: 1, stab: 0, pop: 0.0, cost: 22 },
    "团队训练": { tech: 1, tac: 2, phys: 0, stab: 0, pop: 0.0, cost: 22 },
    "体能训练": { tech: 0, tac: 0, phys: 2, stab: 1, pop: 0.0, cost: 18 },
    "直播排位": { tech: 0, tac: 1, phys: 0, stab: 2, pop: 0.5, cost: 15 },
    "休息":   { tech: 0, tac: 0, phys: 0, stab: 0, pop: 0.0, cost: -50 },
  },
  INTENSITY: { "休养": [0.8, 0.8], "正常": [1.0, 1.0], "高强度": [1.2, 1.2] },

  TRAIN_EVENT_P: 0.35,

  W_TECH: 0.40, W_TAC: 0.35, W_PHYS: 0.15, W_STAB: 0.10,

  WIN_POP: { "常规": 0.5, "季后": 1.0, "IVS": 2.0, "预选": 1.0, "小组": 3.0, "总决": 10.0 },
  OPP_POP: { "常规": 5, "季后": 20, "IVS": 50, "深渊": 80 },

  CHAMP_REWARD: { "夏": [30, 3000], "秋": [30, 3000], "IVS": [25, 2000], "深渊": [120, 10000] },
  FMVP_REWARD: [20, 1500],
  RUNNERUP_POP: 8,

  SELECT_VACANCY_P: 0.05,
  FMVP_F_MIN: 90,
};

function selectThreshold(year) { return 32 + (year - 1) * 2.5; }       // 赛年1=32 … 赛年7=47
function npcSelf(year) { return Math.min(68, 58 + (year - 1)); }       // 自队 NPC 基准
function growthTech(year) { return year <= 3 ? 1.0 : Math.max(0.60, 1 - 0.05 * (year - 3)); }
const growthPhys = growthTech;
function growthTac(year) { return year <= 3 ? 1.0 : Math.max(0.75, 1 - 0.03 * (year - 3)); }
function oppDelta(year) { return Math.min(1.5 * (year - 1), 6); }

function sampleOpp(stage, year) {                                       // 对手战队得分
  const d = oppDelta(year);
  if (stage === "常规") {
    if (year === 1) return triangular(31, 58, 46);                     // 新秀赛季
    return triangular(45, 72, 60) + d;
  }
  if (stage === "季后") return rnd(58, 75) + d;                         // v1.2: [58,75]
  if (stage === "IVS") return rnd(70, 84) + d;
  if (stage === "预选") return rnd(52, 74) + d;
  if (stage === "小组") return rnd(68, 84) + d;
  if (stage === "总决") return rnd(76, 90) + d;
  throw new Error("unknown stage " + stage);
}

/* ------------------------------- 商店 ---------------------------------- */
// kind: 'attr' 立即生效属性; 'consume' 进背包; 'wrist' 当年护腕; 'clear' 清debuff
const SHOP_ITEMS = [
  { name: "柠檬水", price: 100, qty: 5, kind: "consume", tag: "stam", val: 30, desc: "体力 +30（可携带，比赛/训练中使用）" },
  { name: "筋膜枪", price: 300, qty: 3, kind: "consume", tag: "stam", val: 60, desc: "体力 +60（可携带）" },
  { name: "护腕", price: 500, qty: 1, kind: "wrist", desc: "当年比赛受伤概率 ×0.4" },
  { name: "好运签", price: 500, qty: 2, kind: "consume", tag: "fbuff", val: 8, desc: "下一场比赛 F +8（可携带）" },
  { name: "单练机会", price: 600, qty: 2, kind: "attr", eff: { tech: 5 }, desc: "技术 +5（立即，不受衰减）" },
  { name: "复盘机会", price: 600, qty: 2, kind: "attr", eff: { tac: 5 }, desc: "战术 +5（立即）" },
  { name: "好心态", price: 600, qty: 2, kind: "attr", eff: { stab: 4 }, desc: "稳定性 +4（立即）" },
  { name: "理疗康复套餐", price: 600, qty: 2, kind: "consume", tag: "heal", desc: "清除伤病 debuff（可携带）" },
  { name: "俱乐部公关", price: 1200, qty: 1, kind: "clear", tag: "news", desc: "立即清除负面新闻 debuff" },
  { name: "定制应援物料", price: 400, qty: 2, kind: "consume", tag: "fbuff", val: 5, pop: 0.5, desc: "下一场 F +5、人气 +0.5（可携带）" },
  { name: "运动营养师", price: 800, qty: 2, kind: "attr", eff: { phys: 4 }, desc: "体能 +4（立即）" },
  { name: "私人陪练", price: 1200, qty: 2, kind: "attr", eff: { tech: 2, tac: 2 }, desc: "技术 +2、战术 +2（立即）" },
  { name: "战术分析仪", price: 700, qty: 1, kind: "consume", tag: "fbuff", val: 6, desc: "下一场 F +6（可携带）" },
];

/* ------------------------------ Player --------------------------------- */
class Player {
  constructor(identity, name, position) {
    this.identity = identity;
    this.name = name || "无名选手";
    this.position = position || "求生者";

    // 基础随机(裸值) —— 见三.2
    this.appearance = rnd(1, 100);
    this.phys = rnd(35, 45);
    this.tech = rnd(25, 35);
    this.tac = rnd(25, 35);
    this.stab = rnd(25, 35);
    this.luck = rnd(1, 100);          // 隐藏
    this.money = 1000;
    this.pop = 1;
    this.stamina = 0;

    // 初始身份修正 —— 见三.3
    if (identity === "青训") {
      for (const k of ["phys", "tech", "tac", "stab"]) this[k] += 3;
    } else if (identity === "主播") {
      this.stab += 3; this.money = 3000; this.pop = 20;
    } else if (identity === "人皇") {
      this.tech += 12; this.tac += 5;
    }
    this._clamp();

    // 状态
    this.is_starter = false;
    this.consec_fail = 0;
    this.first_year_failed = false;
    this.ever_starter = false;
    this.has_wrist = false;
    this.negative_news = false;
    this.teno_next = false;
    this.injury_this_tourney = false;
    this.nextGameBuff = 0;        // 道具临时 buff(好运签/定制/战术分析仪)，下一场生效后清零

    // 背包(可携带消耗品)
    this.inv = { "柠檬水": 0, "筋膜枪": 0, "好运签": 0, "定制应援物料": 0, "战术分析仪": 0, "理疗康复套餐": 0 };

    // 计数器
    this.champ = { "夏": 0, "秋": 0, "IVS": 0, "深渊": 0 };
    this.runnerups = 0;
    this.fmvp_total = 0;
    this.fmvp_seq = [];
    this.ev_count = 0;            // 漫展+商务+节目 次数

    // 记录(用于回顾)
    this.titles = [];             // 历年荣誉文本
    this.offered = new Set();     // 已弹过的半途结局(本周目不再提示)
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
  addPop(base) { this.pop += base * this.pop_mult; }

  // 训练/事件成长：软上限 (100-当前)/70 边际递减；减益直接生效
  grow(attr, amount) {
    if (amount <= 0) { this[attr] = Math.max(0, this[attr] + amount); return; }
    const cur = this[attr];
    const factor = clamp((100 - cur) / 70, 0, 1);
    this[attr] = Math.min(100, cur + amount * factor);
  }
  // 总冠军数
  get totalChamp() { return this.champ["夏"] + this.champ["秋"] + this.champ["IVS"] + this.champ["深渊"]; }
}

/* ---------------------------- 训练应用 --------------------------------- */
function applyTraining(p, proj, intensity, year) {
  const [eff, sm] = CONFIG.INTENSITY[intensity];
  const t = CONFIG.TRAIN[proj];
  const gt = growthTech(year), gtc = growthTac(year), gp = growthPhys(year);
  if (t.tech) p.grow("tech", t.tech * eff * gt);
  if (t.tac) p.grow("tac", t.tac * eff * gtc);
  if (t.phys) p.grow("phys", t.phys * eff * gp);
  if (t.stab) p.grow("stab", t.stab * eff);   // 稳定性不衰减(仍走软上限)
  if (t.pop) p.addPop(t.pop * eff);
  p.stamina = Math.min(p.stamina_max, p.stamina - t.cost * sm);
  p._clamp();
}

/* --------------------------- 训练期事件数据 ---------------------------- *
 * options: [{label, hint, apply(p)->resultText}]
 * 人气走 addPop(×外貌系数)；技/战/体走 grow(软上限)；体力/资金直接加减。
 * 与脚本一致：事件里的属性成长不再额外乘 growthMult。
 * --------------------------------------------------------------------- */
const TRAIN_EVENTS = {
  "电竞节": {
    flavor: "城里办起了大型电竞节，主办方向你发来邀请函。",
    options: [
      { label: "参加", hint: "技术+3 战术+3 资金+500 体力−25", apply(p){ p.grow("tech",3); p.grow("tac",3); p.money+=500; p.stamina-=25; return "你在台上和粉丝互动，也偷师了几手版本理解。技术/战术各+3，资金+500，体力−25。"; } },
      { label: "不参加", hint: "体力+20（休整）", apply(p){ p.stamina+=20; return "你窝在基地补觉，养精蓄锐。体力+20。"; } },
    ],
  },
  "漫展邀约": {
    flavor: "一家漫展方邀请你作为嘉宾出席，门票已经卖爆了。",
    options: [
      { label: "前往", hint: "人气+1.5 资金+300 体力−15", apply(p){ p.addPop(1.5); p.money+=300; p.stamina-=15; p.ev_count++; return "现场尖叫不断，人气大涨。人气+1.5(×外貌)，资金+300，体力−15。"; } },
      { label: "专注训练", hint: "技术+2 体能+2", apply(p){ p.grow("tech",2); p.grow("phys",2); return "你婉拒了邀约，留在训练室。技术/体能各+2。"; } },
    ],
  },
  "节目录制": {
    flavor: "某综艺节目想邀你录一期，曝光量不小。",
    options: [
      { label: "参加", hint: "人气+1.5 体力−15", apply(p){ p.addPop(1.5); p.stamina-=15; p.ev_count++; return "节目效果拉满，路人缘+++。人气+1.5(×外貌)，体力−15。"; } },
      { label: "婉拒", hint: "体力+10", apply(p){ p.stamina+=10; return "你选择低调。体力+10。"; } },
    ],
  },
  "商务邀约": {
    flavor: "品牌方拿着一份代言合同找上门来。",
    options: [
      { label: "接受", hint: "资金+1200 技术−2 体力−15", apply(p){ p.money+=1200; p.tech=Math.max(0,p.tech-2); p.stamina-=15; p.ev_count++; return "拍摄占用了不少训练时间。资金+1200，技术−2，体力−15。"; } },
      { label: "专注训练", hint: "技术+2 战术+2", apply(p){ p.grow("tech",2); p.grow("tac",2); return "钱再赚，状态要紧。技术/战术各+2。"; } },
    ],
  },
  "网络舆论": {
    flavor: "评论区冒出一群黑子，对你的发挥冷嘲热讽。",
    options: [
      { label: "与黑子对喷", hint: "体力−5 稳定性+2 人气−2", apply(p){ p.stamina-=5; p.grow("stab",2); p.addPop(-2); return "你下场对线，骂得酣畅却也掉了点粉。体力−5，稳定+2，人气−2。"; } },
      { label: "交俱乐部处理", hint: "稳定性+2 资金−300", apply(p){ p.grow("stab",2); p.money-=300; return "公关团队出手平息。稳定+2，资金−300。"; } },
    ],
  },
  "老子才是老大": {
    flavor: "队内气氛微妙，关于谁是核心的争论暗流涌动。",
    options: [
      { label: "抗压熬夜单排", hint: "技术+4 人气+1 体力−30", apply(p){ p.grow("tech",4); p.addPop(1); p.stamina-=30; return "你用通宵冲分证明自己。技术+4，人气+1，体力−30。"; } },
      { label: "与队员复盘", hint: "战术+4 稳定性+2 体力−15", apply(p){ p.grow("tac",4); p.grow("stab",2); p.stamina-=15; return "一场深夜复盘让全队拧成一股绳。战术+4，稳定+2，体力−15。"; } },
      { label: "开小号狂喷", hint: "体力+5；25%被扒→人气−5 稳定−4", apply(p){ p.stamina+=5; if(Math.random()<0.25){ p.addPop(-5); p.stab=Math.max(0,p.stab-4); return "小号被扒了个底朝天，翻车。体力+5，人气−5，稳定−4。"; } return "你偷偷发泄了一通，没被发现。体力+5。"; } },
    ],
  },
  "不速之客": {
    flavor: "深夜训练室来了个不速之客……",
    options: [
      { label: "膝跳弹射逃离", hint: "战术+2 体能+2", apply(p){ p.grow("tac",2); p.grow("phys",2); return "一个箭步溜得飞快。战术/体能各+2。"; } },
      { label: "化险为夷", hint: "稳定性+4", apply(p){ p.grow("stab",4); return "你沉着应对，虚惊一场。稳定+4。"; } },
    ],
  },
  "浴室惊魂": {
    flavor: "你在基地浴室差点滑倒，惊出一身冷汗。",
    options: [
      { label: "体面爬出求救", hint: "体能−3 体力−15", apply(p){ p.phys=Math.max(0,p.phys-3); p.stamina-=15; return "你扭了一下，所幸无大碍。体能−3，体力−15。"; } },
      { label: "顾不上呼救", hint: "体力−10", apply(p){ p.stamina-=10; return "你硬撑着爬起来。体力−10。"; } },
    ],
  },
  "老板跑路": {
    flavor: "传言俱乐部老板资金链断裂，工资可能要拖。",
    options: [
      { label: "多接代打", hint: "技术+3 稳定性+2", apply(p){ p.grow("tech",3); p.grow("stab",2); return "你靠代打补贴，也练了手。技术+3，稳定+2。"; } },
      { label: "专心训练", hint: "技术+3 战术+3", apply(p){ p.grow("tech",3); p.grow("tac",3); return "风浪越大鱼越贵，你选择沉住气。技术/战术各+3。"; } },
    ],
  },
  "版本答案": {
    flavor: "新版本上线，强势打法浮出水面。",
    options: [
      { label: "啃硬骨头", hint: "技术+5 体能−4 体力−30", apply(p){ p.grow("tech",5); p.phys=Math.max(0,p.phys-4); p.stamina-=30; return "你肝穿了新套路。技术+5，体能−4，体力−30。"; } },
      { label: "摆烂保状态", hint: "稳定性+3 体力+15 人气−2", apply(p){ p.grow("stab",3); p.stamina+=15; p.addPop(-2); return "你选择保养身体，被嘲不思进取。稳定+3，体力+15，人气−2。"; } },
    ],
  },
  "手机风波": {
    flavor: "你的私人手机疑似被人翻看，可能有截图流出。",
    options: [
      { label: "交经理处理", hint: "稳定性+3", apply(p){ p.grow("stab",3); return "经理快速灭火。稳定+3。"; } },
      { label: "自己收（被造谣）", hint: "稳定性−4", apply(p){ p.stab=Math.max(0,p.stab-4); return "你自己处理却越描越黑。稳定−4。"; } },
    ],
  },
  "私联粉丝": {
    flavor: "一位热情粉丝私信约你线下见面……（直觉告诉你，这事有风险）",
    options: [
      { label: "婉拒", hint: "无影响；10%传为佳话→人气+3", apply(p){ if(Math.random()<0.10){ p.addPop(3); return "你礼貌婉拒，反被夸有底线，传为佳话。人气+3。"; } return "你婉拒了对方。无事发生。"; } },
      { label: "赴约", hint: "⚠ 高风险：可能直接断送生涯", apply(p){
          const minor = Math.random() < 0.50;     // 50% 未成年
          const exposed = Math.random() < 0.45;   // 45% 被曝光
          if (minor && exposed) { p._fired = true; return "对方竟是未成年，且现场被拍。俱乐部即刻与你解约——【你被开除了！】"; }
          if (!minor && exposed) { p.addPop(-8); p.stab=Math.max(0,p.stab-5); p.negative_news=true; return "成年粉丝，但被偷拍上了热搜。人气−8，稳定−5，叠加负面新闻。"; }
          if (Math.random() < 1) { p.grow("stab",3); }
          return "侥幸没被曝光，你长舒一口气（但已踩雷）。稳定+3。";
        } },
    ],
  },
};
const TRAIN_EVENT_KEYS = Object.keys(TRAIN_EVENTS);

/* ------------------------- 运气判定 / 比赛期事件 ----------------------- */
function luckCheck(p) { return p.luck + rnd(0, 40) >= 70; }

// 返回 {needChoice, key, flavor, options} 或 {fdelta, log}(无需选择的自动事件)
function rollMatchEvent(p) {
  if (p.stamina < 30) {                                  // 受伤(自动)
    const pr = 0.12 * (p.has_wrist ? 0.4 : 1.0);
    if (Math.random() < pr) {
      p.phys = Math.max(0, p.phys - 5);
      p.injury_this_tourney = true;
      return { fdelta: 0, log: "⚠ 体力透支受伤！体能−5，本赛事剩余场次 F−8。" };
    }
  }
  if (Math.random() < 0.005) {                           // 火热进行中(极低)
    return { needChoice: true, key: "火热进行中", flavor: "场边出现一位异性观众频频向你示意……比赛进行中！",
      options: [
        { label: "坐怀不乱", hint: "人气+3", apply(p){ p.addPop(3); return "你目不斜视，专业素养拉满。人气+3。"; }, fdelta: 0 },
        { label: "几欲先走", hint: "资金+500", apply(p){ p.money+=500; return "赛后你收下了对方递来的红包……资金+500。"; }, fdelta: 0 },
      ] };
  }
  if (Math.random() < 0.08) {                            // BP 风波
    return { needChoice: true, key: "BP风波", flavor: "BP 阶段队内出现分歧：要不要抢一手强势位？",
      options: [
        { label: "选强度（吃版本）", hint: "技术≥70且运气过→F+10，否则−8", apply(p){ if(p.tech>=70 && luckCheck(p)) return {f:10, txt:"强势英雄打出统治力！本场 F+10。"}; return {f:-8, txt:"硬抢翻车，被针对了。本场 F−8。"}; } },
        { label: "选绝活（保守）", hint: "本场 F−3", apply(p){ return {f:-3, txt:"稳妥起手，但被针对了节奏。本场 F−3。"}; } },
      ], custom: true };
  }
  if (Math.random() < 0.06) {                            // 设备调试中
    return { needChoice: true, key: "设备调试中", flavor: "你的外设突然出问题，裁判询问是否暂停。",
      options: [
        { label: "暂停检修", hint: "稳定+2，本场 F−4", apply(p){ p.grow("stab",2); return {f:-4, txt:"换了套设备，手感打折但心态稳了。稳定+2，本场 F−4。"}; } },
        { label: "硬刚", hint: "本场 F−6；技术≥70且运气过→人气+4", apply(p){ let extra=""; if(p.tech>=70 && luckCheck(p)){ p.addPop(4); extra=" 你顶着卡顿打出名场面，人气+4！"; } return {f:-6, txt:"你拒绝暂停硬着头皮打。本场 F−6。"+extra}; } },
      ], custom: true };
  }
  if (Math.random() < 0.05) {                            // 粉丝应援扇(自动正面)
    p.addPop(2);
    return { fdelta: 4, log: "看台举起你的应援扇，士气大振！人气+2，本场 F+4。" };
  }
  return { fdelta: 0, log: null };
}

/* ------------------------------ FMVP ----------------------------------- */
function teammateAvgs(year, nGames) {
  const base = npcSelf(year);
  const res = [];
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let g = 0; g < nGames; g++) s += base + rnd(-12, 15);
    res.push(s / nGames);
  }
  return res;
}
// 资格: 场均F>=90 且 >= 4名队友各自场均; 资格后投票 P=clamp(.30,.70,.50+(F-90)*.02)
function checkFMVP(p, year, fList) {
  if (!fList.length) return { won: false };
  const avg = fList.reduce((a, b) => a + b, 0) / fList.length;
  if (avg < CONFIG.FMVP_F_MIN) return { won: false, avg, reason: "low" };
  const mates = teammateAvgs(year, fList.length);
  if (!mates.every(t => avg >= t)) return { won: false, avg, reason: "mate" };
  const pVote = clamp(0.50 + (avg - 90) * 0.02, 0.30, 0.70);
  return { won: Math.random() < pVote, avg, reason: "vote", p: pVote };
}

/* --------------------------- 结算辅助函数 ------------------------------ */
function settleChamp(p, kind, fmvp) {
  const [popR, moneyR] = CONFIG.CHAMP_REWARD[kind];
  p.addPop(popR); p.money += moneyR; p.champ[kind] += 1;
  if (fmvp) { p.fmvp_total += 1; p.addPop(CONFIG.FMVP_REWARD[0]); p.money += CONFIG.FMVP_REWARD[1]; }
  p.fmvp_seq.push(!!fmvp);
}
function settleRunnerup(p, kind) {
  p.runnerups += 1; p.addPop(CONFIG.RUNNERUP_POP); p.money += CONFIG.CHAMP_REWARD[kind][1] / 3;
}

function maxRunTrue(seq) { let best = 0, cur = 0; for (const v of seq) { cur = v ? cur + 1 : 0; best = Math.max(best, cur); } return best; }

/* ----------------------- 半途特殊结局门槛判定 -------------------------- */
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

/* ------------------------- 成就 / 最终结局 ----------------------------- */
function computeAchievements(p, grandSlam) {
  const a = [];
  const bigSlam = p.champ["夏"] >= 1 && p.champ["秋"] >= 1 && p.champ["深渊"] >= 1;
  if (grandSlam) a.push("金满贯");
  if (bigSlam) a.push("大满贯");
  if (p.champ["IVS"] >= 1) a.push("洲际之巅");
  if (p.champ["夏"] + p.champ["秋"] + p.champ["深渊"] >= 1) a.push("冠军选手");
  if (p.fmvp_total >= 1) a.push("FMVP");
  if (maxRunTrue(p.fmvp_seq) >= 2) a.push("专属王朝");
  if (p.pop >= 300) a.push("电竞白月光");
  if (p.tech >= 90) a.push("操作手");
  if (p.tac >= 90) a.push("战队大脑");
  if (p.tech >= 80 && p.tac >= 80 && p.phys >= 80 && p.stab >= 80) a.push("全能选手");
  if (p.first_year_failed && p.ever_starter && p.totalChamp >= 1) a.push("光荣的荆棘路");
  if (p.totalChamp === 0 && p.pop >= 130) a.push("流量为王");
  if (p.pop >= 800 && p.money >= 100000 && p.totalChamp >= 5 && p.fmvp_total >= 2) a.push("老大");
  return a;
}

// 最终结局(优先级)；forced 为强制结局名(优先)
function finalEnding(p, grandSlam, forced) {
  if (forced) return forced;
  const total = p.totalChamp;
  const bigSlam = p.champ["夏"] >= 1 && p.champ["秋"] >= 1 && p.champ["深渊"] >= 1;
  const dynasty = maxRunTrue(p.fmvp_seq) >= 2;
  if (grandSlam) return "时代丰碑";
  if (bigSlam) return "黄金之路";
  if (dynasty) return "专属王朝";
  if (total >= 1) return "金雨之下";
  if (total === 0 && p.runnerups >= 3 && p.tech >= 85 && p.tac >= 85) return "无冕之王";
  if (p.pop < 30 && p.money < 5000) return "隐入人海";
  if (total === 0 && p.pop < 50) return "黯然退役";
  return "断开链接";
}

/* ----------------------- 结局/成就 文案库 ------------------------------ */
const ENDING_TEXT = {
  // 强制
  "饮水机管理员": "漫长的替补席消磨掉了最后的斗志。你成了队里最熟悉饮水机的人，赛季结束便悄然离队。有些故事，还没开始就结束了。",
  "你被开除了！": "私联未成年粉丝的照片传遍全网，俱乐部连夜发布解约声明。一手好牌，葬送在一个最不该犯的错误上。",
  // 半途特殊(接受时)
  "签约艺人": "你优越的外形和赛场人气被经纪公司看中。脱下队服换上礼服，你转身走进了聚光灯——电竞只是你的起点。",
  "短剧演员": "你出色的颜值与艺能被娱乐圈相中，短剧片约一部接一部。那还说啥了，我将震碎娱乐圈！",
  "转行解说": "你嘴比手快、战术理解超群。退役后坐上解说席，金句频出，成了观众最爱的「嘴强王者」。",
  "转行教练": "国内有冠、却始终未能登顶世界。你把全部经验交给下一代，作为全能老将转型主教练，带队冲击那座你没能摸到的奖杯。",
  "校长好": "资历、财力、人气三者兼备，你开办了自己的电竞学校。校长好！下一个传奇，或许就从这里走出。",
  // 最终(优先级)
  "时代丰碑": "金满贯！同一年里你把夏季赛、秋季赛、IVS、深渊四座奖杯尽数收入囊中。你的名字，就此刻进电竞史册——这是一座时代的丰碑。",
  "黄金之路": "大满贯达成。夏、秋、深渊三冠在手，你走完了一条属于顶级选手的黄金之路，无愧于这个时代最好的求生／监管之一。",
  "专属王朝": "连续两届 FMVP，你不仅赢，还赢得无可争议。这是属于你一个人的王朝。",
  "金雨之下": "至少一座冠军奖杯在握。金色彩带落下时，你站在舞台中央——这一刻，所有的训练都有了意义。",
  "无冕之王": "你技战术俱佳、三度杀进决赛，却始终差一口气与冠军失之交臂。无冕，但人们记得你的实力——无冕之王。",
  "隐入人海": "没有冠军，没有流量，也没攒下什么钱。赛季结束，你悄悄退役，隐入茫茫人海。但那段拼过的青春，只有你自己知道分量。",
  "黯然退役": "七年征战，终究没能等到属于自己的高光时刻。你黯然退役，关掉直播间的那一刻，弹幕安静了下来。",
  "断开链接": "故事到这里，戛然而止。没有惊天动地的结局，就像大多数普通选手那样——你只是，断开了链接。",
};

const ACH_DESC = {
  "金满贯": "同一年内夺得夏/秋/IVS/深渊四冠",
  "大满贯": "夏/秋/深渊冠军各至少 1 次",
  "洲际之巅": "IVS 冠军 ≥1",
  "冠军选手": "任意赛事（除 IVS）冠军 ≥1",
  "FMVP": "当选 FMVP ≥1",
  "专属王朝": "连续 2 次当选 FMVP",
  "电竞白月光": "人气 ≥300 万",
  "操作手": "技术 ≥90",
  "战队大脑": "战术 ≥90",
  "全能选手": "技/战/体/稳 均 ≥80",
  "光荣的荆棘路": "首年选拔曾失败，后转正并夺冠",
  "流量为王": "全生涯 0 冠却人气 ≥130 万（隐藏）",
  "老大": "人气≥800·资金≥10万·冠军≥5·FMVP≥2（究极隐藏）",
};

/* 暴露到全局(plain script，无模块) */
window.IVL = {
  CONFIG, SHOP_ITEMS, Player, rnd, randint, triangular, clamp,
  OPP_POP: CONFIG.OPP_POP, WIN_POP: CONFIG.WIN_POP, CHAMP_REWARD: CONFIG.CHAMP_REWARD,
  selectThreshold, npcSelf, growthTech, growthTac, growthPhys, oppDelta, sampleOpp,
  applyTraining, TRAIN_EVENTS, TRAIN_EVENT_KEYS, luckCheck, rollMatchEvent,
  teammateAvgs, checkFMVP, settleChamp, settleRunnerup, maxRunTrue,
  specialTriggers, computeAchievements, finalEnding, ENDING_TEXT, ACH_DESC,
};
