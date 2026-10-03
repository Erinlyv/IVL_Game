/* 从 IVL_Game/game.js 总决赛模块直接提取。
 * 保留原文案、DOM、判定表与交互；仅适配国家队输入、运动会序章、独立保存及暂停恢复。 */
window.IVLSportsFinals = function(cfg) {
  const P=cfg.player, curYear=cfg.year || 1;
  let rng=cfg.seed >>> 0;
  const Math=Object.create(window.Math);
  Math.random=()=>{rng=(window.Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const cosmeticD120=()=>window.Math.floor(window.Math.random()*120)+1;
  const cosmeticD6=()=>window.Math.floor(window.Math.random()*6)+1;
const GF_TIER_NAME = { crit: '大成功', good: '成功', near: '险胜', bad: '失败', fumble: '大失败' };
const GF_TIER_STYLE = { crit: 'tier-good', good: 'tier-good', near: 'tier-mid', bad: 'tier-bad', fumble: 'tier-bad' };
const GF_OUT_STYLE = { crit: 'good', good: 'good', near: 'mid', bad: 'bad', fumble: 'bad' };
const GF_MOD_LABEL = { adv: '优势骰', dis: '劣势骰', radv: '1-6 随机优势', rdis: '1-6 随机劣势' };
const gfD120 = () => Math.floor(Math.random() * 120) + 1;
const gfD6 = () => Math.floor(Math.random() * 6) + 1;

/* 判定核心：点数 vs 能力值。1-10 大成功；≥110 大失败（能力>90 时收窄为 115-120）；
 * 点数≤能力值→成功（差值≤15 记为「险胜」）；否则失败。临界档按加减后的最终投点决定。 */
function gfJudge(point, ability) {
  const fumbleLo = ability > 90 ? 115 : 110;
  if (point <= 10) return 'crit';
  if (point >= fumbleLo) return 'fumble';
  if (point <= ability) return (ability - point) <= 15 ? 'near' : 'good';
  return 'bad';
}
/* 判定表自洽冒烟（不静默，失败即抛） */
(function gfSelfCheck() {
  const cases = [[5, 80, 'crit'], [10, 80, 'crit'], [110, 80, 'fumble'], [115, 80, 'fumble'],
  [80, 80, 'near'], [65, 80, 'near'], [64, 80, 'good'], [90, 80, 'bad'],
  [112, 95, 'bad'], [116, 95, 'fumble'], [10, 95, 'crit']];
  for (const [p, a, exp] of cases) {
    const got = gfJudge(p, a);
    if (got !== exp) throw new Error(`gfJudge(${p},${a}) 期望 ${exp}，实得 ${got}`);
  }
})();

/* ---------- 求生者定位序列（转写自 demo12 求生者 UI / 反馈稿） ----------
 * 每个 event：{n, title, prompt, stat, auto}
 *   stat: '技术'|'战术'|'ally'(队友均值)|'tacMax'(战术/队友较高者)
 *   auto: true = 队友自动投掷（不受玩家全局加减影响）
 * 每个 tier：{t:文案, end:[你,对手], mod:临时骰, skip:跳到事件号}
 *   end 出现 = 这半场在此定格该比分；mod: adv/dis/radv/rdis（作用于下一次投掷）
 * -------------------------------------------------------------------- */
const GF_KZ = [ // 牵制位
  { n: 1, title: '开局首个追击', prompt: '你被首个追击。请开始牵制（与你的技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你直接 1695，带领队伍拿下本局胜利。', end: [5, 0] },
      good: { t: '你 1693，4 人开门战势在必得。队友救人压力很小，将获得一个优势骰。', mod: 'adv' },
      near: { t: '你在密码机两台半时吃闪倒地，稳稳的平局节奏。' },
      bad: { t: '你在密码机两台时倒地，且没能吃出闪现，队友救人压力将非常大——将在救人环节获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你开局震慑，局势非常不利。队友将在救人环节获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 2, title: '队友前来救援', prompt: '你的队友前来救援，救人博弈情况（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '无伤救援并提供了非常好的二次牵制机会，成功进入四人开门战并获胜。', end: [3, 1] },
      good: { t: '无伤救援并成功为你扛刀，你的二次牵制将获得一个优势骰。', mod: 'adv' },
      near: { t: '队友吃一刀将你救下。' },
      bad: { t: '队友把你救下后没能及时拉走，导致双倒，没有获得二次牵制机会。（直接进入二救）', skip: 4 },
      fumble: { t: '队友救人震慑，四抓已成定局。', end: [0, 5] },
    } },
  { n: 3, title: '二次牵制', prompt: '下椅后你进入二次牵制。请开始牵制（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你直接遛到了密码机压好，并在四人开门战中成功三跑。', end: [3, 1] },
      good: { t: '你在密码机压好前倒地，不过只要压满救机子就够了。队友将在二救中获得一个 1-6 的优势。', mod: 'radv' },
      near: { t: '你牵制了一段时间后二次上椅。' },
      bad: { t: '你并没有遛出搏命便二次上椅，队友还没来得及换位，将在二救中获得一个 1-6 的劣势。', mod: 'rdis' },
      fumble: { t: '你遛到了救人位队友的遗产机，监管者机人同守，半血队友直接被击倒。似乎已经没有翻盘的可能了。', end: [0, 5] },
    } },
  { n: 4, title: '队友再次救援', prompt: '队友再次前来救援。（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '无伤救援并提供了非常好的三次牵制机会，成功进入四人开门战并获胜。', end: [3, 1] },
      good: { t: '无伤救援并成功为你扛刀，你的三次牵制将获得一个优势骰。', mod: 'adv' },
      near: { t: '队友吃一刀将你救下。' },
      bad: { t: '队友把你救下后没能及时拉走，导致双倒，没有获得三次牵制机会。（直接进入残局运营）', skip: 6 },
      fumble: { t: '队友本想再给你套一个搏命，却被直接震慑，监管无缝续上二手节奏。残局运营将获得一个劣势骰。', mod: 'dis', skip: 6 },
    } },
  { n: 5, title: '三次牵制', prompt: '三次牵制，请开始牵制（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你的三次牵制博弈全赢，直接遛到密码机压好，并在四人开门战中成功三跑。', end: [3, 1] },
      good: { t: '你的三次牵制拖了不少时间，队友稳稳进入三人开门战。残局运营获得优势骰。', mod: 'adv' },
      near: { t: '你的三次牵制拖了一小点时间，至少有了三人开门战的可能。' },
      bad: { t: '你倒在了队友的遗产机，密码机进度被迫停滞。残局运营获得 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你倒在了队友的遗产机，队友想 ob 你一下却双倒。残局运营将获得劣势骰。', mod: 'dis' },
    } },
  { n: 6, title: '残局运营', prompt: '你挂飞后进入残局运营阶段。（与战术/队友较高者比较）', stat: 'tacMax',
    tiers: {
      crit: { t: '献祭队友获得神助，队伍奇迹般地三跑了。', end: [3, 1] },
      good: { t: '你挂飞后队伍稳健运营，没给对面扩大优势的机会，拿下平局。', end: [2, 2] },
      near: { t: '有一些波折但最终也成功保平。', end: [2, 2] },
      bad: { t: '监管者控住了遗产机，成功拖出了技能，最终三抓。', end: [1, 3] },
      fumble: { t: '灾难般的运营与开门战，四抓只是来得晚了一点。', end: [0, 5] },
    } },
];
const GF_JR = [ // 救人位
  { n: 1, title: '队友一遛', prompt: '你的队友是监管者首个追击目标，队友的一遛（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '队友天秀，遛了监管者好几台机的时间，你几乎不用急着救人。第一次救援获得一个优势骰。', mod: 'adv' },
      good: { t: '队友稳稳牵制住监管者，为你留足了救人准备时间。第一次救援获得一个 1-6 的随机优势。', mod: 'radv' },
      near: { t: '队友两台半吃技能倒地，一切都在计划之中。' },
      bad: { t: '队友遛得不顺很快上椅，你的救人节奏被打乱了。第一次救援获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友开局秒倒，监管者已经守在椅子边。第一次救援获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 2, title: '椅前博弈', prompt: '你出发救援上椅的队友，请开始椅前博弈（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '神乎其技的卡半无伤救！还顺势为队友扛刀换防，局势瞬间逆转。你和队友在帮助二次牵制中各获得一个优势骰。', mod: 'adv' },
      good: { t: '你无伤救下队友并扛刀拉走，成功稳住了局面。帮助二次牵制获得一个优势骰。', mod: 'adv' },
      near: { t: '你吃了一刀把队友救下，两人安全撤离。' },
      bad: { t: '你救人被拦刀，虽把队友救下自己却倒地，双倒的局势十分被动。帮助二次牵制获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你救人震慑，直接被拍飞，监管者形成了完美的守椅。似乎已经没有翻盘的可能了。', end: [0, 5] },
    } },
  { n: 3, title: '二次救援', prompt: '你再次出发救援队友，请开始救援（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你完美压满救并保下队友三次牵制，队伍完成了三台机的惊天翻盘。', end: [3, 1] },
      good: { t: '你稳稳救下队友并扛刀拉走，二手节奏中获得一个优势骰。', mod: 'adv' },
      near: { t: '你吃一刀救下队友，勉强维持住了局面。' },
      bad: { t: '你救人被拦截，虽勉强救下但双倒。二手节奏获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你救人再次震慑，监管者机人同守，翻盘无望。', end: [0, 5] },
    } },
  { n: 4, title: '监管续二手', prompt: '队友挂飞后，监管者续二手节奏的目标变成了半血的你（与你的战术平均值比较）', stat: '战术',
    tiers: {
      crit: { t: '你提前拉走了，监管者扑了个空，完全续不上二手节奏。残局运营获得一个优势骰。', mod: 'adv' },
      good: { t: '你提前拉走，但监管者还是看到了脚印，你牵制到了密码机压好。残局运营获得一个 1-6 的随机优势。', mod: 'radv' },
      near: { t: '你没能提前拉走，但提前下板蹭了个板弹拉开距离。' },
      bad: { t: '你没能拖太长时间就上椅了。残局运营获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你完全走神了，监管者传送到脸上才看到，直接被击倒在遗产机机人同守。失败似乎只是时间问题。', end: [1, 3] },
    } },
  { n: 5, title: '残局运营', prompt: '残局运营（与战术/队友较高者比较）', stat: 'tacMax',
    tiers: {
      crit: { t: '你冷静指挥，队伍抓住监管者最后的传门失误奇迹般地三跑了。', end: [3, 1] },
      good: { t: '你们稳健运营，没给对面扩大优势的机会，稳稳保平。', end: [2, 2] },
      near: { t: '开门战有些波折，但最终也成功保平。', end: [2, 2] },
      bad: { t: '监管者控住了遗产机，成功拖出了技能，最终三抓。', end: [1, 3] },
      fumble: { t: '残局运营彻底崩盘，队伍被四抓收场。', end: [0, 5] },
    } },
];
const GF_OB = [ // ob 位
  { n: 1, title: '队友一遛', prompt: '你的队友是监管者首个追击目标，队友的一遛（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '队友天秀遛穿全场！你修开密码机走门离开，队友地窖逃生，喜提四跑。', end: [5, 0] },
      good: { t: '队友牵制住监管者 3 台机。队友在第一次救援中获得一个优势骰。', mod: 'adv' },
      near: { t: '队友的牵制中规中矩，一切照常。' },
      bad: { t: '队友遛得不顺很快上椅，你不得不提前放弃机子准备 ob。队友第一次救援获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友开局秒倒，监管者已经准备拦截救援了。队友第一次救援获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 2, title: '队友一救', prompt: '救人位队友去上班了！队友的一救如何（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '无伤卡半救并创造了二次牵制空间，你专心 ob 即可。第一次 ob 获得一个优势骰。', mod: 'adv' },
      good: { t: '队友无伤救下人并扛刀拉走，局面很健康。第一次 ob 获得一个 1-6 的随机优势。', mod: 'radv' },
      near: { t: '队友吃一刀救下人，节奏正常推进。' },
      bad: { t: '队友救人吃刀后双倒，你必须立刻上前 ob。第一次 ob 获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友救人震慑，形势急转直下。（直接进入二救，二救获得一个劣势骰）', mod: 'dis', skip: 4 },
    } },
  { n: 3, title: '第一次 ob', prompt: '是你大展身手的时候了，请开始 ob（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你的 ob 宛如天神下凡，监管者拿你一点办法都没有，你成功保活队友，队伍运转出巨大优势。', end: [3, 1] },
      good: { t: '你的 ob 恰到好处，成功为队友拖出安全身距。队友第二次救援获得一个优势骰。', mod: 'adv' },
      near: { t: '你将监管击晕了 2 秒，为队友争取了一点牵制空间。' },
      bad: { t: '你的 ob 时机没抓准，没能保护队友反被监管击中，白白掉了状态。队友第二次救援获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你送刀式 ob 直接被秒，监管者将你牵起来打气球刀，队友的救援雪上加霜。队友第二次救援获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 4, title: '队友二救', prompt: '队友的二救如何（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '无伤卡半救并创造了三次牵制空间，你专心 ob 即可。第二次 ob 获得一个优势骰。', mod: 'adv' },
      good: { t: '队友稳稳救下人并扛刀拉走。第二次 ob 获得一个优势骰。', mod: 'adv' },
      near: { t: '队友吃一刀救下人。' },
      bad: { t: '队友救人后双倒，残局压力骤增，你必须拖出自愈的时间。第二次 ob 获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友救人震慑，你又被监管者拦截到了，四抓只是时间问题了。', end: [0, 5] },
    } },
  { n: 5, title: '第二次 ob', prompt: '队友的三次牵制必须有人辅助才能拖更多时间，请开始 ob（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你不断干扰监管，又为队友挡下关键一刀，监管被迫换追，队伍最终完成三跑。', end: [3, 1] },
      good: { t: '你成功拖住监管者，为残局运营创造了空间。残局运营获得一个优势骰。', mod: 'adv' },
      near: { t: '你的 ob 拖了一点时间，残局尚有一战之力。' },
      bad: { t: '你 ob 失败倒地，但好在队友还活了一小段时间，密码机进度被迫停滞。残局运营获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你的 ob 和送人头无异，双倒让局势陷入巨大劣势。残局运营获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 6, title: '残局运营', prompt: '队友挂飞，进入三人残局运营时间（与战术/队友较高者比较）', stat: 'tacMax',
    tiers: {
      crit: { t: '你抓住监管者最后的失误，跳地窖奇迹般地三跑。', end: [3, 1] },
      good: { t: '你们稳健运营，没给对面扩大优势的机会，稳稳保平。', end: [2, 2] },
      near: { t: '有些波折，但最终也成功保平。', end: [2, 2] },
      bad: { t: '监管者控住了遗产机，成功拖出了技能，最终三抓。', end: [1, 3] },
      fumble: { t: '残局彻底崩盘，队伍被四抓收场。', end: [0, 5] },
    } },
];
const GF_FZ = [ // 辅助位
  { n: 1, title: '队友一遛', prompt: '你的队友是监管者首个追击目标，队友的一遛（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '队友天秀遛穿全场！你修开密码机走门离开，队友地窖逃生，喜提四跑。', end: [5, 0] },
      good: { t: '队友稳稳牵制住监管者，你得以专心破译密码机。队友第一次救援获得一个优势骰。', mod: 'adv' },
      near: { t: '队友的牵制中规中矩，一切照常。' },
      bad: { t: '队友遛得不顺很快上椅，你必须提前转点接应。队友第一次救援获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友开局秒倒，全队节奏被打乱。队友第一次救援获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 2, title: '队友一救', prompt: '队友的一救如何（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '救人位无伤卡半救并创造了绝佳的二遛条件，你的辅助压力并不大。第一次辅助获得一个优势骰。', mod: 'adv' },
      good: { t: '队友稳稳救下人并扛刀拉走。第一次辅助获得一个优势骰。', mod: 'adv' },
      near: { t: '队友吃一刀救下人，节奏正常。' },
      bad: { t: '队友救人吃刀后双倒，你必须立刻去摸队友。第一次辅助获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友救人震慑，形势急转直下。（直接进入二救，二救获得一个劣势骰）', mod: 'dis', skip: 4 },
    } },
  { n: 3, title: '陪跑辅助', prompt: '队友在麦里喊你来陪跑一段，请开始辅助（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你完美地辅助队友拉开了身距，二遛了监管者好几台机，密码机直接压好。', end: [3, 1] },
      good: { t: '你及时分压，辅助队友转入安全点，牵制了不短的时间。队友第二次救援获得一个优势骰。', mod: 'adv' },
      near: { t: '你陪跑了一小段，为队伍争取了时间。' },
      bad: { t: '你在陪跑中大胆翻窗不幸被震慑。队友第二次救援获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你的辅助赔了夫人又折兵，与队友双双倒地。队友第二次救援获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 4, title: 'ob 位救援', prompt: 'ob 位队友出发救援（与队友平均水平比较）', stat: 'ally', auto: true,
    tiers: {
      crit: { t: '队友一个长球精彩撞救。第二次辅助获得一个优势骰。', mod: 'adv' },
      good: { t: '队友稳稳救下人并扛刀拉走。第二次辅助获得一个优势骰。', mod: 'adv' },
      near: { t: '队友吃一刀救下人，并喊你一起来保上挂飞。' },
      bad: { t: '队友救人后尝试 ob 却自己先倒地，你需要立刻出发了。第二次辅助获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '队友救人震慑，四抓已近在眼前。第二次辅助获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 5, title: '你的辅助时间', prompt: '现在是你的辅助时间！（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你的辅助让上挂飞顺利离开监管视线，监管一下子失去了节奏，队伍默契配合最终完成三跑。', end: [3, 1] },
      good: { t: '你成功接遛分压，为残局运营创造了空间。残局运营获得一个优势骰。', mod: 'adv' },
      near: { t: '你的辅助拖了一点时间，残局尚有一战之力。' },
      bad: { t: '你的辅助就是无脑抗刀，倒地后密码机进度停滞。残局运营获得一个 1-6 的随机劣势。', mod: 'rdis' },
      fumble: { t: '你的辅助赔了夫人又折兵，与队友双双倒地，监管无缝续上节奏让局势彻底失控。残局运营获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 6, title: '残局运营', prompt: '队友挂飞，进入三人残局（与战术/队友较高者比较）', stat: 'tacMax',
    tiers: {
      crit: { t: '你抓住监管者最后的失误，指挥队伍奇迹般地三跑。', end: [3, 1] },
      good: { t: '你稳健运营，没给对面扩大优势的机会，稳稳保平。', end: [2, 2] },
      near: { t: '有些波折，但最终也成功保平。', end: [2, 2] },
      bad: { t: '监管者控住了遗产机，成功拖出了技能，最终三抓。', end: [1, 3] },
      fumble: { t: '残局彻底崩盘，队伍在开门战最终被四抓。', end: [0, 5] },
    } },
];
const GF_HUNTER_HALF = { // 求生者主场：监管者队友上场（决定监管半场比分）
  n: '监', title: '监管者队友上场', prompt: '轮到你的监管者队友上场了！你看着 ta 的表现', stat: 'ally', auto: true,
  tiers: {
    crit: { t: '队友天神下凡，四杀对手。', end: [5, 0] },
    good: { t: '队友发挥相当不错，稳稳地三抓。', end: [3, 1] },
    near: { t: '队友稳定发挥，拿下了一个平局。', end: [2, 2] },
    bad: { t: '队友没能突破对面，在开门战靠挽留留下了一个人。', end: [1, 3] },
    fumble: { t: '队友全场游龙完全不知道在干什么，最后只能眼睁睁看着对面四跑。', end: [0, 5] },
  },
};

/* ---------- 监管者类型序列（转写自反馈稿 · 监管方节点） ---------- */
const GF_ZJ = [ // 追击型
  { n: 1, title: '追击', prompt: '你追击首个目标，请开始追击（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '对面一个慢翻，开局直接被你震慑，这是绝佳的开始。守椅拦截获得一个优势骰。', mod: 'adv' },
      good: { t: '你快速击倒对手，甚至省下了技能。守椅拦截获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你交出技能击倒对手，节奏尚可。' },
      bad: { t: '你被 1693，还被砸了好几个板，你的操作开始急躁起来。守椅拦截获得一个劣势骰。', mod: 'dis' },
      fumble: { t: '蹲蘑菇战术让你完全找不到人，在原地徘徊许久才去找下一个目标，可是对面已经提前拉走，忙活了半天，密码机已经压好了。开门战获得一个劣势骰。', mod: 'dis', skip: 6 },
    } },
  { n: 2, title: '守椅拦截', prompt: '救人位前来，你判读来向进行守椅拦截（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '你完美预判了对面的来向，救人位还没来得及到椅下就被你击倒，而其他人完全没做好补位的准备。四抓已经是你的囊中之物。', end: [5, 0] },
      good: { t: '这是一次成功的守椅拦截，虽然对面吃一刀还是到了椅下，但也没给二遛空间。在处理 ob 位中获得一个 1-6 随机优势。', mod: 'radv', skip: 4 },
      near: { t: '你决定稳一手，在椅下等着救人位前来。' },
      bad: { t: '你拦截失败，让对面无伤救援，但好在还是在搏命结束前击倒了上椅的人。在处理 ob 位中获得一个劣势骰。', mod: 'dis', skip: 4 },
      fumble: { t: '你大胆拦截，但完全错判了方向，等你回过神来，手里已经一个人也没有了。二次追击获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 3, title: '二次追击', prompt: '你继续追击下椅的求生者（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你快速击倒求生者并挂在了救人位大遗产附近，ob 位试图保队友但也双双倒地，机人同守。对面的密码机被迫停滞。在运营中获得一个优势骰。', mod: 'adv', skip: 5 },
      good: { t: '你很快将求生者击倒，并顺手干扰了旁边的遗产。对面想要不丢分就必须来争了。在处理 ob 位中获得一个优势骰。', mod: 'adv' },
      near: { t: '你并没有给对面太多二次牵制的空间。' },
      bad: { t: '对面的 ob 位一路陪跑，让你的追击非常难受，你必须先处理这个烦人的 ob 位了。在处理 ob 位中获得一个劣势骰。', mod: 'dis' },
      fumble: { t: '你完全被对面的 ob 扰乱了阵脚，上椅的人早已无影无踪，你心急如焚，操作也完全变形。胜利的天平已经倾斜向了对面，最终以对面三跑结束了对局。', end: [1, 3] },
    } },
  { n: 4, title: '处理 ob 位', prompt: '烦人的 ob 位就在眼前，处理掉 ta（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: 'ob 时一个慢翻被你抓住机会直接震慑双倒，节奏尽在你掌握之中，运营获得一个优势骰。', mod: 'adv' },
      good: { t: '对方试图用技能硬控你但没有成功，反而帮你解擦了。运营获得一个 1-6 的随机优势。', mod: 'radv' },
      near: { t: '你的距离把握的很好，没有被控住，追击的脚步并没有因此停下。' },
      bad: { t: 'ob 位一路陪跑把你烦的够呛，你花了一段时间才处理掉 ta。运营获得一个劣势骰。', mod: 'dis' },
      fumble: { t: '几次眩晕后，上挂飞早已不见，而眼前的 ob 位也处理不掉。密码机已经压好，四人开门战。你只能留下一个了。', end: [1, 3] },
    } },
  { n: 5, title: '运营', prompt: '你进入中后期运营（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '你快速击倒了下一个求生者，将其挂上椅后直接传送去管最后一台机，并在密码机附近击倒了修机的人。求生者疲于奔命，在修开最后一台机前被你全部淘汰。', end: [5, 0] },
      good: { t: '你快速击倒了下一个求生者，将其挂上椅后直接传送去管最后一台机，机子还差 40%。你还有时间。开门战获得一个优势骰。', mod: 'adv' },
      near: { t: '你有意识地消耗求生者的状态和道具，为开门战做铺垫。' },
      bad: { t: '你在最后两台机之间反复拉扯，然而你并没有给足压力，密码机还是压好了，好在你的技能也转好了。开门战获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你费了半天劲才击倒了下一个求生者，然后密码机已经压好，电闸声响起，留给你的时间不多了。开门战获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 6, title: '开门战', prompt: '进入开门战（与技术、战术平均值比较）', stat: 'atkTac',
    tiers: {
      crit: { t: '你快速击倒一位，又传送到门口，此时门还没点开，四抓！', end: [5, 0] },
      good: { t: '开门战第一定律：先打救人的人！你排到了卡中场的那个求生者，顺利拿下三抓。', end: [3, 1] },
      near: { t: '开门战 n-1 原则，你击倒一位求生者但其他两位也已经点开了门，你最终拿下平局。', end: [2, 2] },
      bad: { t: '你没能在开门战击倒任何一位，反而被他走了地窖。', end: [1, 3] },
      fumble: { t: '你开门战本来想切传送，却切成了窥视者，还赌错了门。只能眼睁睁看着对面四跑。', end: [0, 5] },
    } },
];
const GF_KC = [ // 控场型
  { n: 1, title: '追击', prompt: '你追击首个目标，请开始追击（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '对面一个慢翻，开局直接被你震慑，这是绝佳的开始。守椅拦截获得一个优势骰。', mod: 'adv' },
      good: { t: '你快速击倒对手，甚至省下了技能。守椅拦截获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你交出技能击倒对手，节奏尚可。' },
      bad: { t: '你被 1693.5，还被砸了好几个板，你的操作开始急躁起来。守椅拦截获得一个劣势骰。', mod: 'dis' },
      fumble: { t: '蹲蘑菇战术让你完全找不到人，在原地徘徊许久才去找下一个目标，可是对面已经提前拉走，你一无所获。', end: [0, 5] },
    } },
  { n: 2, title: '守椅拦截', prompt: '救人位前来，你判读来向进行守椅拦截（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '你精准预判了救人位的来向，救人双倒，机人同守，对面的破译节奏彻底停滞。干扰密码机获得一个优势骰。', mod: 'adv' },
      good: { t: '这是一次成功的守椅拦截，对面吃一刀才到椅下，也没给二遛空间。干扰密码机获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你稳一手守在椅下，没让对面轻易救走。' },
      bad: { t: '你拦截失败，让对面无伤救援，但好在搏命结束前击倒了上椅的人。干扰密码机获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你大胆拦截却错判了方向，人被救走还没来得及干扰机子，节奏落空。干扰密码机获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 3, title: '干扰密码机', prompt: '你转入巡回封机（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '多台密码机进度停滞，遗产机被你死死压住，对面疲于奔命地转点。运营获得一个优势骰。', mod: 'adv' },
      good: { t: '你有节奏地巡回封机，成功拖慢破译，压住一台大遗产。运营获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你在几台机之间来回巡视，对方的破译进度被迫放缓。' },
      bad: { t: '你试图干扰密码机却顾此失彼，对面分摊压力照常修机。运营获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你在几台机之间反复奔波却收效甚微，密码机接连亮起。开门战获得一个劣势骰。', mod: 'dis', skip: 5 },
    } },
  { n: 4, title: '运营消耗', prompt: '你消耗对面状态与道具（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '你精准的控血与消耗让对面全员半血、道具见底，在修开最后一台机前被你逐个淘汰。', end: [5, 0] },
      good: { t: '你有意识地消耗对面的状态和道具，压好半场后将人挂上椅，转点去封最后一台机。开门战获得一个优势骰。', mod: 'adv' },
      near: { t: '你稳步消耗着对面的状态和道具，为开门战做铺垫。' },
      bad: { t: '你在最后两台机之间反复拉扯，却没能给足压力，机子还是压好了，好在技能也转好了。开门战获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你的运营完全脱节，密码机接连压好，电闸声将响，留给你的时间不多了。开门战获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 5, title: '开门战', prompt: '进入开门战（与技术、战术平均值比较）', stat: 'atkTac',
    tiers: {
      crit: { t: '你快速击倒一位，又传送到门口，此时门还没点开，四抓！', end: [5, 0] },
      good: { t: '开门战第一定律：先打救人的人！你卡住中场那名求生者，顺利拿下三抓。', end: [3, 1] },
      near: { t: '开门战 n-1 原则，你击倒一位求生者，但其他两位也点开了门，最终拿下平局。', end: [2, 2] },
      bad: { t: '你没能在开门战留下任何一位，反而被走了地窖。', end: [1, 3] },
      fumble: { t: '你开门战脑子一团浆糊，心急之下传送还传错了门，只能眼睁睁看着对面四跑。', end: [0, 5] },
    } },
];
const GF_SY = [ // 守椅型
  { n: 1, title: '追击', prompt: '你追击首个目标，请开始追击（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '对面一个慢翻，开局直接被你震慑，这是绝佳的开始。守椅拦截获得一个优势骰。', mod: 'adv' },
      good: { t: '你快速击倒对手，甚至省下了技能。守椅拦截获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你交出技能击倒对手，节奏尚可。' },
      bad: { t: '你被 1693，还被砸了好几个板，你的操作开始急躁起来。守椅拦截获得一个劣势骰。', mod: 'dis' },
      fumble: { t: '蹲蘑菇战术让你完全找不到人，在原地徘徊许久才去找下一个目标，可是对面已经提前拉走，你一无所获。', end: [0, 5] },
    } },
  { n: 2, title: '守椅拦截', prompt: '救人位前来，你判读来向进行守椅拦截（与战术数值比较）', stat: '战术',
    tiers: {
      crit: { t: '你完美预判了救人位的来向，救人位还没来得及到椅下就被你击倒，其他人也完全没做好补位的准备。四抓已经是你的囊中之物。', end: [5, 0] },
      good: { t: '这是一次成功的守椅拦截，虽然对面吃一刀还是到了椅下。守椅博弈获得一个 1-6 随机优势。', mod: 'radv', skip: 3 },
      near: { t: '你决定稳一手，在椅下等着救人位前来。' },
      bad: { t: '你拦截失败，让对面无压力到了椅下。守椅博弈获得一个劣势骰。', mod: 'dis', skip: 3 },
      fumble: { t: '你大胆拦截，但完全错判了方向，等你回过神来，手里已经一个人也没有了。二次追击获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 3, title: '守椅博弈', prompt: '你与救人位在椅前博弈（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你看穿了对面的骗救节奏，救人的一瞬间恐惧震慑，对面的破译被迫停滞。二次守椅获得一个优势骰。', mod: 'adv', skip: 5 },
      good: { t: '你椅前博弈稳住了节奏，对面救人位吃了两刀倒地。二次追击获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你和对面在椅前反复博弈，最终对面吃一刀把人救下。' },
      bad: { t: '你不幸打椅，让对面无伤救援。二次追击获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你的椅前博弈完全被对面拿捏，救援丝滑无伤还抗到了刀。二次追击获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 4, title: '追击下椅者', prompt: '你继续追击下椅的求生者（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你快速击倒下椅的求生者并将其挂在大遗产附近，前来 ob 的人也被你打成了半状态。对面的密码机被迫停滞。二次守椅获得一个优势骰。', mod: 'adv' },
      good: { t: '你很快将下椅的求生者击倒挂上狂欢之椅，并在守椅时用技能干扰了旁边的遗产。二次守椅获得一个 1-6 随机优势。', mod: 'radv' },
      near: { t: '你没有给对面太多二遛的空间，就将其再次送上了椅。' },
      bad: { t: '对面下椅后一路遛你，还遛出了搏命，你的二手节奏被拖得很难受。二次守椅获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你被下椅的求生者遛穿全场，密码机趁机压好，四人开门战，你只能留下一个了。开门战获得一个劣势骰。', mod: 'dis', skip: 6 },
    } },
  { n: 5, title: '第二次守椅', prompt: '你再次进入守椅博弈（与技术数值比较）', stat: '技术',
    tiers: {
      crit: { t: '你再次完美守椅拦截，救人位与 ob 位一同倒下，对面在修开最后一台机前被你逐个淘汰。', end: [5, 0] },
      good: { t: '你发挥优势稳稳守椅，逼对面吃刀救援又没给二遛，挂飞求生者后去管最后一台机。开门战获得一个优势骰。', mod: 'adv' },
      near: { t: '你决定求稳，直接给救人位一刀。' },
      bad: { t: '你的守椅拦截失败，对面无伤救走了人。开门战获得一个 1-6 随机劣势。', mod: 'rdis' },
      fumble: { t: '你的守椅博弈接连失误，人被救走，密码机也压好了，电闸声随之响起。开门战获得一个劣势骰。', mod: 'dis' },
    } },
  { n: 6, title: '开门战', prompt: '进入开门战（与技术、战术平均值比较）', stat: 'atkTac',
    tiers: {
      crit: { t: '你快速击倒一位，又传送到门口，此时门还没点开，四抓！', end: [5, 0] },
      good: { t: '开门战第一定律：先打救人的人！你排到了卡中场的求生者，顺利拿下三抓。', end: [3, 1] },
      near: { t: '开门战 n-1 原则，你击倒一位求生者但其他两位也已经点开了门，你最终拿下平局。', end: [2, 2] },
      bad: { t: '你没能在开门战击倒任何一位，反而被 ta 走了地窖。', end: [1, 3] },
      fumble: { t: '你开门战操作完全变形，心急之下还传错了门，只能眼睁睁看着对面四跑。', end: [0, 5] },
    } },
];
const GF_SURV_HALF = { // 监管者主场：求生方队友上场（决定求生半场比分）
  n: '生', title: '求生方队友上场', prompt: '轮到你的求生者队友们上场了！你看着他们的表现', stat: 'ally', auto: true,
  tiers: {
    crit: { t: '队友们的配合完美无缺，最终跳地窖拿下四跑！', end: [5, 0] },
    good: { t: '队友 1693，每个人都没有什么失误，最终顺利拿下三跑。', end: [3, 1] },
    near: { t: '队友们在对面监管者手中保平。', end: [2, 2] },
    bad: { t: '队友开局失误秒倒，后续虽然努力运营但也没能被保平，最终跑一。', end: [1, 3] },
    fumble: { t: '摧枯拉朽的四抓，你简直看不下去。', end: [0, 5] },
  },
};

/* 定位（chargen 位置 key）→ 序列 / 专属剧情触发率 / 队友半场 / 阵营。
 * 求生者未触发专属剧情时「不幸首个被追击」走牵制位(GF_KZ)；监管者恒走本类型。 */
const GF_POS = {
  qz: { name: '牵制位', seq: GF_KZ, own: 1.00, half: GF_HUNTER_HALF, camp: 'surv' },
  jr: { name: '救人位', seq: GF_JR, own: 0.90, half: GF_HUNTER_HALF, camp: 'surv' },
  ob: { name: 'OB 位', seq: GF_OB, own: 0.70, half: GF_HUNTER_HALF, camp: 'surv' },
  fz: { name: '辅助位', seq: GF_FZ, own: 0.65, half: GF_HUNTER_HALF, camp: 'surv' },
  zj: { name: '追击型', seq: GF_ZJ, own: 1.00, half: GF_SURV_HALF, camp: 'hunter' },
  kc: { name: '控场型', seq: GF_KC, own: 1.00, half: GF_SURV_HALF, camp: 'hunter' },
  sy: { name: '守椅型', seq: GF_SY, own: 1.00, half: GF_SURV_HALF, camp: 'hunter' },
};

/* =======================================================================
 * runGrandFinals：总决赛特殊玩法弹窗（整屏 overlay #gfOverlay）
 * ===================================================================== */
function runGrandFinals(cfg) {
  return new Promise((resolve) => {
    let replaying = (cfg.replayActions || 0) > 0;
    let actionCount = 0;
    const isFast = () => replaying || !!window.__KO_FAST || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const T = (ms) => isFast() ? 0 : ms;
    const gq = (id) => document.getElementById(id);
    const isHunter = (P.role === '监管者');
    const wantCamp = isHunter ? 'hunter' : 'surv';
    let posKey = P.position || (isHunter ? 'zj' : 'qz');
    // demov5.0feedback·转位置修复(防御兜底)：若定位所属阵营与当前阵营不符（老存档 / 异常），
    // 回退到新阵营默认定位，避免总决赛走错剧情线。正常流程下 switchRole 已同步改派定位。
    if (!GF_POS[posKey] || GF_POS[posKey].camp !== wantCamp) { posKey = isHunter ? 'zj' : 'qz'; }
    const posDef = GF_POS[posKey];
    const teamNpc = P.teamNpc(curYear);
    const youName = cfg.youName || P.teamName || '你的战队';
    const oppName = cfg.oppName || '对手';

    // 能力值 → 检定对象（实时读 P 四维 + 队友均值 + 消耗后体力）
    function abilityOf(stat) {
      if (stat === '技术') return Math.round(P.tech);
      if (stat === '战术') return Math.round(P.tac);
      if (stat === 'ally') return teamNpc;
      if (stat === 'tacMax') return Math.max(Math.round(P.tac), teamNpc);
      if (stat === 'atkTac') return Math.round((P.tech + P.tac) / 2);
      if (stat === 'stam') return Math.round(P.stamina);
      if (stat === 'quad') return Math.round((P.tech + P.tac + P.phys + P.stab + teamNpc) / 5);
      return 80;
    }
    function cmpLabel(stat) {
      if (stat === 'ally') return '队友均值 ' + teamNpc;
      if (stat === 'tacMax') return '战术/队友较高 ' + Math.max(Math.round(P.tac), teamNpc);
      if (stat === 'atkTac') return '技术战术均值 ' + abilityOf('atkTac');
      if (stat === '技术') return '技术 ' + Math.round(P.tech);
      if (stat === '战术') return '战术 ' + Math.round(P.tac);
      return stat + ' ' + abilityOf(stat);
    }

    const S = {
      phase: 'intro', playedName: posDef.name, forcedKZ: false,
      seq: posDef.seq, half: posDef.half, camp: posDef.camp, ei: 0,
      home: null, globalBuffs: [], pendingMod: null,
      coin: { p: null, o: null }, stateDice: [],
      myScore: [0, 0], allyScore: [0, 0], finalWin: null,
      lastOwnTier: null, rollCtl: null, wentOvertime: false,
    };
    const myLabel = S.camp === 'surv' ? '求生局' : '监管局';
    const allyLabel = S.camp === 'surv' ? '监管局' : '求生局';

    // —— overlay DOM —— //
    const holder = document.createElement('div');
    holder.innerHTML = `<div id="gfOverlay">
      <div class="pop">
        <div class="pop-head">
          <span class="step" id="gf-step">序章</span>
          <div class="htxt"><div class="ey" id="gf-ey">GRAND FINAL</div><div class="ttl" id="gf-ttl">冠亚之争</div></div>
          <div class="spacer"></div>
          <button class="help" id="gf-help" title="玩法说明">?</button>
        </div>
        <div class="scorebar" id="gf-scorebar">
          <div class="sc you"><span class="lab">你方 · ${youName}</span><span class="val mono" id="gf-scYou">0</span></div>
          <div class="sc opp"><span class="lab">对手 · ${oppName}</span><span class="val mono" id="gf-scOpp">0</span></div>
        </div>
        <div class="pop-body" id="gf-body"></div>
        <div class="pop-foot"><button class="gfbtn" id="gf-act">继续</button><div class="hint" id="gf-hint"></div></div>
      </div>
      <div class="rules" id="gf-rules"><div class="sheet">
        <div class="rh"><div><div class="ey">HOW TO PLAY</div><div class="ttl">总决赛玩法说明</div></div><button class="x" id="gf-rulesX">×</button></div>
        <div class="rb">晋级冠亚决赛后开启，按你的<b>场上定位</b>进入不同剧情。
          <h4>判定方式</h4>每遇到一次事件，掷一个 <b>1–120</b> 的随机数，与对应能力值比较：
          <div class="kv"><span class="k">点数 ≤ 能力值</span><span>成功（点数越低发挥越好）</span></div>
          <div class="kv"><span class="k">点数 > 能力值</span><span>失败</span></div>
          <div class="kv"><span class="k">1 – 10</span><span>无视能力值，直接<b>大成功</b></span></div>
          <div class="kv"><span class="k">110 – 120</span><span>无视能力值，直接<b>大失败</b>（能力>90 时收窄为 115–120）</span></div>
          <h4>优势骰 / 劣势骰</h4>
          <div class="kv"><span class="k">优势骰</span><span>连掷两次取<b>更低</b>者</span></div>
          <div class="kv"><span class="k">劣势骰</span><span>连掷两次取<b>更高</b>者</span></div>
          <div class="kv"><span class="k">1-6 优/劣</span><span>额外掷 D6，从点数中<b>减/加</b>其值</span></div>
          <h4>加点 / 减点</h4>比赛日状态与 BP 给你的<b>全局投点</b>加减（减点=更强）；临时骰只影响下一次投掷。队友投点不受你的全局加减影响。
        </div>
      </div></div>
    </div>`;
    document.body.appendChild(holder.firstElementChild);
    const overlay = gq('gfOverlay');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'gf-ttl');
    const pause = document.createElement('button'); pause.className = 'help'; pause.id = 'gf-pause'; pause.textContent = '‹'; pause.setAttribute('aria-label', '暂存并返回赛程'); pause.title = '暂存并返回赛程';
    gq('gf-help').before(pause); gq('gf-help').setAttribute('aria-label', '玩法说明'); gq('gf-rulesX').setAttribute('aria-label', '关闭玩法说明');
    if (replaying) overlay.classList.add('restoring');
    function suspend() { if (gq('gf-act').disabled || replaying) return; overlay.remove(); document.removeEventListener('keydown', onKey); resolve({paused: true}); }
    pause.onclick = suspend;

    function setHead(step, ey, ttl) { gq('gf-step').textContent = step; gq('gf-ey').textContent = ey; gq('gf-ttl').textContent = ttl; }
    // demov5.0feedback《文案》：比赛过程中标题里的定位（牵制位/救人位/OB 位/辅助位）去掉「位」字。
    function posTitle(name) { return String(name || '').replace(/\s*位$/, ''); }
    function updateScore() { gq('gf-scYou').textContent = S.myScore[0] + S.allyScore[0]; gq('gf-scOpp').textContent = S.myScore[1] + S.allyScore[1]; }
    function showScorebar(on) { gq('gf-scorebar').classList.toggle('show', on); }
    function setAct(label, cls, hint, disabled) {
      const b = gq('gf-act'); b.className = 'gfbtn' + (cls ? ' ' + cls : ''); b.textContent = label;
      b.disabled = !!disabled; if (gq('gf-pause')) gq('gf-pause').disabled = !!disabled; b.style.display = label ? '' : 'none'; gq('gf-hint').textContent = hint || '';
    }
    function modChip(m) { if (!m) return ''; const good = (m === 'adv' || m === 'radv'); return `<span class="chip ${good ? 'pos' : 'neg'}"><span class="ic">${good ? '▲' : '▼'}</span>${GF_MOD_LABEL[m]}</span>`; }
    function renderBuffs() {
      const globals = [];
      if (S.home !== null) globals.push(`<span class="chip home">${S.home ? '主场' : '客场'}</span>`);
      S.globalBuffs.forEach(b => { const good = b.delta < 0; globals.push(`<span class="chip ${good ? 'pos' : 'neg'}"><span class="ic">${good ? '▲' : '▼'}</span>${b.label} ${b.delta > 0 ? '+' : ''}${b.delta}</span>`); });
      if (globals.length === 0) globals.push('<span class="chip empty">暂无</span>');
      const temp = S.pendingMod ? modChip(S.pendingMod) : '<span class="chip empty">暂无</span>';
      return `<div class="buffs"><div class="buffgrp"><div class="bl">全局 · GLOBAL</div><div class="chips">${globals.join('')}</div></div>
        <div class="buffgrp"><div class="bl">临时 · TEMP</div><div class="chips">${temp}</div></div></div>`;
    }
    const stripCmp = s => s.replace(/（与[^）]*）/g, '').trim();

    /* 投掷引擎（1-120，分步演出）；cb({tier, point}） */
    function animateRoll(ability, applyGlobal, cb) {
      const mod = S.pendingMod;
      const twoDie = (mod === 'adv' || mod === 'dis');
      const isRand = (mod === 'radv' || mod === 'rdis');
      const buffs = applyGlobal ? S.globalBuffs.filter(b => b.delta !== 0) : [];
      const zone = gq('gf-rollZone'); if (zone) zone.classList.add('show');
      const body = gq('gf-rollBody');
      body.innerHTML = `<div class="dtiles" id="gf-srcRow"></div>
        <div class="mainpt" id="gf-mainPt"><span class="mv" id="gf-mvNum">?</span><span class="mvlab">点数 · 越低越好</span></div>
        <div class="stepline" id="gf-stepLine"></div><div class="tierbadge" id="gf-tierBadge"></div>`;
      const mainPt = gq('gf-mainPt'), mvNum = gq('gf-mvNum'), srcRow = gq('gf-srcRow'), stepLine = gq('gf-stepLine');
      const clamp = v => Math.max(1, Math.min(120, v));
      let point;
      function addStep(txt, cls) { const s = document.createElement('span'); s.className = 'stepchip' + (cls ? ' ' + cls : ''); s.textContent = txt; stepLine.appendChild(s); }
      function bump() { mainPt.classList.remove('bump'); void mainPt.offsetWidth; mainPt.classList.add('bump'); }
      function finish() {
        point = clamp(point); mvNum.textContent = point;
        const tier = gfJudge(point, ability);
        if (tier === 'crit') mainPt.classList.add('crit');
        if (tier === 'fumble') mainPt.classList.add('fumble');
        addStep(`能力值 ${ability}`, '');
        gq('gf-tierBadge').innerHTML = `<span class="tg ${GF_TIER_STYLE[tier]}">${GF_TIER_NAME[tier]}</span>`;
        S.rollCtl = null; setTimeout(() => cb({ tier, point }), T(300));
      }
      function applyBuffs(i) {
        if (i >= buffs.length) { finish(); return; }
        const b = buffs[i]; point += b.delta; mvNum.textContent = clamp(point); bump();
        addStep(`${b.label} ${b.delta > 0 ? '+' : ''}${b.delta}`, b.delta < 0 ? 'pos' : 'neg');
        setTimeout(() => applyBuffs(i + 1), T(520));
      }
      function rollRandomDie() {
        S.rollCtl = null; setAct('掷骰中…', '', null, true);
        const tile = document.createElement('div'); tile.className = 'd120 mini rolling'; tile.id = 'gf-d6tile';
        tile.innerHTML = `<span class="dv">?</span><span class="dm">D6</span>`; srcRow.appendChild(tile);
        const done = (v) => {
          tile.classList.remove('rolling'); tile.classList.add('settle'); tile.querySelector('.dv').textContent = v;
          const delta = (mod === 'radv') ? -v : v; point += delta; mvNum.textContent = clamp(point); bump();
          addStep(`${mod === 'radv' ? '随机优势' : '随机劣势'} ${delta > 0 ? '+' : ''}${delta}`, delta < 0 ? 'pos' : 'neg');
          setTimeout(() => applyBuffs(0), T(560));
        };
        if (isFast()) { done(gfD6()); return; }
        let n = 0; const spin = setInterval(() => {
          tile.querySelector('.dv').textContent = cosmeticD6();
          if (++n > 9) { clearInterval(spin); done(gfD6()); }
        }, 70);
      }
      function afterBase() {
        addStep(`原始 ${point}`, '');
        if (isRand) { setAct('掷 1-6 骰', S.camp === 'surv' ? 'surv' : '', null); S.rollCtl = rollRandomDie; }
        else applyBuffs(0);
      }
      setAct('投掷中…', '', null, true);
      if (twoDie) {
        srcRow.innerHTML = `<div class="d120 mini rolling" id="gf-db0"><span class="dv">?</span><span class="dm">1-120</span></div>
          <span class="dieconn">取${mod === 'adv' ? '低' : '高'}</span>
          <div class="d120 mini rolling" id="gf-db1"><span class="dv">?</span><span class="dm">1-120</span></div>`;
        mainPt.classList.add('rolling');
        const done = () => {
          const a = gfD120(), b = gfD120(), base = (mod === 'adv') ? Math.min(a, b) : Math.max(a, b);
          gq('gf-db0').classList.remove('rolling'); gq('gf-db1').classList.remove('rolling');
          gq('gf-db0').querySelector('.dv').textContent = a; gq('gf-db1').querySelector('.dv').textContent = b;
          const chosen = (mod === 'adv') ? (a <= b ? 0 : 1) : (a >= b ? 0 : 1);
          gq('gf-db' + chosen).classList.add('chosen'); gq('gf-db' + (1 - chosen)).classList.add('dropped');
          mainPt.classList.remove('rolling'); point = base; mvNum.textContent = base; bump();
          setTimeout(afterBase, T(520));
        };
        if (isFast()) { done(); return; }
        let n = 0; const spin = setInterval(() => {
          gq('gf-db0').querySelector('.dv').textContent = cosmeticD120(); gq('gf-db1').querySelector('.dv').textContent = cosmeticD120(); mvNum.textContent = cosmeticD120();
          if (++n > 13) { clearInterval(spin); done(); }
        }, 70);
      } else {
        mainPt.classList.add('rolling');
        const done = (v) => { mainPt.classList.remove('rolling'); mainPt.classList.add('settle'); point = v; mvNum.textContent = v; setTimeout(afterBase, T(470)); };
        if (isFast()) { done(gfD120()); return; }
        let n = 0; const spin = setInterval(() => { mvNum.textContent = cosmeticD120(); if (++n > 13) { clearInterval(spin); done(gfD120()); } }, 70);
      }
    }

    /* --- 阶段渲染 --- */
    function render() {
      const P0 = S.phase;
      showScorebar(['play', 'playDone', 'half', 'tally', 'ot1', 'ot2'].includes(P0));
      updateScore();
      ({ intro: renderIntro, coin: renderCoin, state: renderState, bp: renderBP, play: renderPlay, playDone: renderPlayDone, half: renderHalf, tally: renderTally, ot1: renderOt1, ot2: renderOt2 }[P0] || renderIntro)();
    }
    function renderIntro() {
      setHead('序章', 'GRAND FINAL · BO5', '洲际运动会决赛');
      gq('gf-body').innerHTML = `<div class="narr big">${cfg.intro}</div>`;
      setAct('继续', '', '');
    }
    function renderCoin() {
      setHead('1', 'COIN TOSS', '抽签决定主客场');
      const rolled = S.coin.p !== null, tie = rolled && S.coin.p === S.coin.o;
      let msg;
      if (!rolled) msg = '<span style="color:var(--dim)">点击下方按钮掷出你的骰子</span>';
      else if (tie) msg = '<span style="color:var(--gold2)">点数相同，请重新投掷</span>';
      else if (S.coin.p > S.coin.o) msg = '<span class="coinres win">你的队伍点数更大 · 主场优势</span>';
      else msg = '<span class="coinres lose">对手点数更大 · 你方客场作战</span>';
      gq('gf-body').innerHTML = `<div class="narr">工作人员找你们来抽签决定主客场，<b>主场队伍将拥有优先选图权</b>，并在比赛发挥中获得一个<b>优势骰</b>；客场则获得一个<b>劣势骰</b>。</div>
        <div class="rollzone show"><div class="rz-top"><span class="rz-lab">D6 · 谁大谁主场</span><span class="rz-thr">相同则重投</span></div>
          <div class="dtiles">
            <div style="text-align:center"><div class="d120 mini" id="gf-coinP"><span class="dv">${rolled ? S.coin.p : '?'}</span><span class="dm">你的队伍</span></div></div>
            <span class="dieconn">VS</span>
            <div style="text-align:center"><div class="d120 mini" id="gf-coinO"><span class="dv">${S.coin.o !== null ? S.coin.o : '?'}</span><span class="dm">对手队伍</span></div></div>
          </div><div class="rz-detail" id="gf-coinMsg" style="font-size:14px">${msg}</div></div>`;
      if (!rolled) setAct('掷出骰子', 'surv', '');
      else if (tie) setAct('重新投掷', 'surv', '');
      else setAct('进入比赛日', '', '');
    }
    function doCoin() {
      const pEl = gq('gf-coinP'), oEl = gq('gf-coinO');
      pEl.classList.add('rolling'); oEl.classList.add('rolling'); setAct('投掷中…', '', ' ', true);
      const done = () => {
        S.coin.p = gfD6(); S.coin.o = gfD6();
        pEl.classList.remove('rolling'); oEl.classList.remove('rolling');
        pEl.querySelector('.dv').textContent = S.coin.p; oEl.querySelector('.dv').textContent = S.coin.o;
        if (S.coin.p !== S.coin.o) { S.home = S.coin.p > S.coin.o; S.pendingMod = S.home ? 'adv' : 'dis'; }
        render();
      };
      if (isFast()) { done(); return; }
      let n = 0; const spin = setInterval(() => { pEl.querySelector('.dv').textContent = cosmeticD6(); oEl.querySelector('.dv').textContent = cosmeticD6(); if (++n > 12) { clearInterval(spin); done(); } }, 70);
    }
    function renderState() {
      setHead('2', 'MATCH DAY', '比赛日 · 今日状态');
      gq('gf-body').innerHTML = `<div class="narr">你与队友站上了总决赛的赛场。坐在电竞椅前，听着观众们的应援声，你<b>用心感受今日状态</b>。
        <div class="prompt">判定对象：稳定性 ${Math.round(P.stab)}（你的投掷）</div>
        <div class="prompt">${S.home ? '主场优势骰' : '客场劣势骰'}：请点击按钮<b>两次</b>投出两颗骰子。</div></div>
        <div class="rollzone show"><div class="rz-top"><span class="rz-lab">D120 · 稳定性判定</span><span class="rz-thr">能力值 <b>${Math.round(P.stab)}</b></span></div>
          <div class="dtiles" id="gf-stateDice">
            <div class="d120" id="gf-sd0"><span class="dv">?</span><span class="dm">第一投</span></div>
            <span class="dieconn">取${S.home ? '低' : '高'}</span>
            <div class="d120" id="gf-sd1"><span class="dv">?</span><span class="dm">第二投</span></div>
          </div><div class="tierbadge" id="gf-stateBadge"></div><div class="rz-detail" id="gf-stateDetail"></div>
        </div>${renderBuffs()}`;
      S.stateDice = []; setAct('投第一颗骰子', 'surv', '');
    }
    function doStateRoll() {
      const i = S.stateDice.length, el = gq('gf-sd' + i); el.classList.add('rolling'); setAct('投掷中…', '', ' ', true);
      const done = (v) => {
        S.stateDice.push(v); el.classList.remove('rolling'); el.classList.add('settle'); el.querySelector('.dv').textContent = v;
        if (S.stateDice.length < 2) setAct('投第二颗骰子', 'surv', ''); else resolveState();
      };
      if (isFast()) { done(gfD120()); return; }
      let n = 0; const spin = setInterval(() => { el.querySelector('.dv').textContent = cosmeticD120(); if (++n > 11) { clearInterval(spin); done(gfD120()); } }, 70);
    }
    function resolveState() {
      const [a, b] = S.stateDice, base = S.home ? Math.min(a, b) : Math.max(a, b), chosen = (base === a) ? 0 : 1;
      gq('gf-sd' + chosen).classList.add('chosen'); gq('gf-sd' + (1 - chosen)).classList.add('dropped');
      const tier = gfJudge(base, Math.round(P.stab));
      const delta = { crit: -10, good: -5, near: 0, bad: 5, fumble: 10 }[tier];
      if (delta !== 0) S.globalBuffs.push({ label: '状态', delta });
      S.pendingMod = null;
      const txt = { crit: '你今天感觉超乎寻常的好，甚至隐隐感觉超神的发挥。', good: '你内心充满干劲，决心在比赛中打出风采。', near: '你内心十分平静，仿佛一切都无法影响你。', bad: '你感到非常紧张，有些无法集中注意力。', fumble: '不知为何，你的手狂抖不止，甚至难以稳稳地握住手机。' }[tier];
      gq('gf-stateBadge').innerHTML = `<span class="tg ${GF_TIER_STYLE[tier]}">${GF_TIER_NAME[tier]}</span>`;
      gq('gf-stateDetail').textContent = `两投 ${a}/${b} → 取${S.home ? '低' : '高'} ${base}　·　能力值 ${Math.round(P.stab)}`;
      gq('gf-body').querySelector('.narr').innerHTML = `${txt}${delta !== 0 ? `<b style="color:${delta < 0 ? 'var(--ok)' : '#ff9d9d'}"> 本场投点${delta < 0 ? '减去' : '加上'} ${Math.abs(delta)}。</b>` : ''}`;
      gq('gf-body').querySelector('.buffs').outerHTML = renderBuffs();
      setAct('进入 BP 环节', '', '');
    }
    function renderBP() {
      setHead('3', 'BAN & PICK', 'BP 环节');
      const abil = abilityOf('tacMax');
      gq('gf-body').innerHTML = `<div class="narr">这是两队之间战术的博弈。请开始 Ban &amp; Pick。
        <div class="prompt">判定对象：${cmpLabel('tacMax')}（你的投掷）</div></div>
        <div class="rollzone" id="gf-rollZone"><div class="rz-top"><span class="rz-lab">D120 · 战术判定</span><span class="rz-thr">能力值 <b>${abil}</b></span></div>
          <div class="rollbody" id="gf-rollBody"></div></div>${renderBuffs()}`;
      setAct('开始 BP', 'surv', '');
    }
    function doBP() {
      animateRoll(abilityOf('tacMax'), false, (r) => {
        const delta = { crit: -10, good: -5, near: 0, bad: 5, fumble: 10 }[r.tier];
        if (delta !== 0) S.globalBuffs.push({ label: 'BP', delta });
        const txt = { crit: '你们今天洞悉了对面的想法，在 BP 环节取得了极大优势。', good: '你们的 BP 非常成功。', near: '正如你们在赛训中模拟的那样。', bad: 'BP 有些被对面牵着鼻子走。', fumble: '你们的 BP 完全被对面压制，难以发挥出训练水平。' }[r.tier];
        gq('gf-body').querySelector('.narr').innerHTML = `${txt}${delta !== 0 ? `<b style="color:${delta < 0 ? 'var(--ok)' : '#ff9d9d'}"> 本场投点${delta < 0 ? '减去' : '加上'} ${Math.abs(delta)}。</b>` : ''}`;
        gq('gf-body').querySelector('.buffs').outerHTML = renderBuffs();
        setAct('进入对局', 'surv', '');
      });
    }
    /* --- 你亲自打的半场序列 --- */
    function beginPlay() {
      if (S.camp === 'surv') { const own = Math.random() < posDef.own; if (own) { S.seq = posDef.seq; S.playedName = posDef.name; S.forcedKZ = false; } else { S.seq = GF_KZ; S.playedName = '牵制位'; S.forcedKZ = true; } }
      else { S.seq = posDef.seq; S.playedName = posDef.name; S.forcedKZ = false; }
      S.ei = 0; S.phase = 'play'; render();
    }
    function curEvent() { return S.seq[S.ei]; }
    function renderPlay() {
      const ev = curEvent(), abil = abilityOf(ev.stat);
      setHead('4', (S.camp === 'surv' ? 'SURVIVOR · ' : 'HUNTER · ') + posTitle(S.playedName), ev.title);
      const forcedNote = (S.forcedKZ && S.ei === 0) ? `<div class="narr" style="color:#ff9d9d;font-size:12.5px;margin-bottom:6px">你不幸首个被追击。</div>` : '';
      gq('gf-body').innerHTML = `${forcedNote}<div class="narr">${stripCmp(ev.prompt)}
          <div class="prompt">判定对象：${cmpLabel(ev.stat)}${ev.auto ? '（队友投掷，不受你的全局加减影响）' : '（你的投掷，含全局加减）'}</div></div>
        <div class="rollzone" id="gf-rollZone"><div class="rz-top"><span class="rz-lab">D120 · ${ev.auto ? '队友发挥' : '临场发挥'}</span><span class="rz-thr">能力值 <b>${abil}</b></span></div>
          <div class="rollbody" id="gf-rollBody"></div></div><div class="outcome" id="gf-outcome"></div>${renderBuffs()}`;
      setAct(ev.auto ? '看队友发挥' : '该你上场了', 'surv', '');
    }
    function doPlay() {
      const ev = curEvent();
      animateRoll(abilityOf(ev.stat), !ev.auto, (r) => {
        const o = ev.tiers[r.tier]; S.pendingMod = null;
        if (!ev.auto) S.lastOwnTier = r.tier;
        const oc = gq('gf-outcome'); oc.className = 'outcome show ' + GF_OUT_STYLE[r.tier];
        let scoreLine = '';
        if (o.end) scoreLine = `<div class="oscore">${myLabel}定格：你方 ${o.end[0]} : ${o.end[1]} 对手</div>`;
        else if (o.mod) { S.pendingMod = o.mod; scoreLine = `<div class="oscore" style="color:var(--gold2)">获得临时 · ${GF_MOD_LABEL[o.mod]}</div>`; }
        oc.innerHTML = `<div class="oh"><span class="bar"></span><b>${GF_TIER_NAME[r.tier]}</b></div><div class="otxt">${o.t}</div>${scoreLine}`;
        gq('gf-body').querySelector('.buffs').outerHTML = renderBuffs();
        if (o.end) { S.myScore = o.end.slice(); S.phase = 'playDone'; setAct('队友半场 →', '', ''); }
        else {
          let nextIdx = o.skip ? S.seq.findIndex(e => e.n === o.skip) : S.ei + 1;
          if (nextIdx >= S.seq.length || nextIdx < 0) { S.myScore = [2, 2]; S.phase = 'playDone'; setAct('队友半场 →', '', ''); }
          else { S.ei = nextIdx; setAct('继续 →', '', ''); }
        }
        updateScore();
      });
    }
    function renderPlayDone() {
      setHead('4', (S.camp === 'surv' ? 'SURVIVOR 结束' : 'HUNTER 结束'), '你的半场结算');
      gq('gf-body').innerHTML = `<div class="narr big">你在 <b style="color:var(--gf-surv)">${posTitle(S.playedName)}</b> 上的这一局，为队伍拿下了
        <b class="mono">${S.myScore[0]} : ${S.myScore[1]}</b>。<br><br>接下来，轮到你的${S.camp === 'surv' ? '监管者' : '求生者'}队友上场了。</div>`;
      setAct('队友上场', 'surv', '');
    }
    /* --- 队友半场（自动） --- */
    function renderHalf() {
      const ev = S.half;
      setHead('5', S.camp === 'surv' ? 'HUNTER HALF' : 'SURVIVOR HALF', ev.title);
      gq('gf-body').innerHTML = `<div class="narr">${ev.prompt}。
          <div class="prompt">判定对象：队友均值 ${teamNpc}（队友投掷）</div></div>
        <div class="rollzone" id="gf-rollZone"><div class="rz-top"><span class="rz-lab">D120 · 队友半场</span><span class="rz-thr">能力值 <b>${teamNpc}</b></span></div>
          <div class="rollbody" id="gf-rollBody"></div></div><div class="outcome" id="gf-outcome"></div>`;
      setAct('看队友半场', 'surv', '');
    }
    function doHalf() {
      S.pendingMod = null;
      animateRoll(teamNpc, false, (r) => {
        const o = S.half.tiers[r.tier]; S.allyScore = o.end.slice();
        const oc = gq('gf-outcome'); oc.className = 'outcome show ' + GF_OUT_STYLE[r.tier];
        oc.innerHTML = `<div class="oh"><span class="bar"></span><b>${GF_TIER_NAME[r.tier]}</b></div><div class="otxt">${o.t}</div><div class="oscore">${allyLabel}：你方 ${o.end[0]} : ${o.end[1]} 对手</div>`;
        // 停留在 half：由「查看总比分」的点击触发 renderTally 计算 finalWin，避免早于结算读到 null 误入加时。
        updateScore(); setAct('查看总比分', '', '');
      });
    }
    function renderTally() {
      const you = S.myScore[0] + S.allyScore[0], opp = S.myScore[1] + S.allyScore[1];
      setHead('6', 'FINAL SCORE', '总比分结算');
      let verdictTxt, next, nextCls;
      if (you > opp) { verdictTxt = `你方以 <b class="mono" style="color:var(--gf-surv)">${you} : ${opp}</b> 战胜对手！`; next = '揭晓结果 →'; nextCls = ''; S.finalWin = true; }
      else if (you < opp) { verdictTxt = `你方以 <b class="mono" style="color:#ff9d9d">${you} : ${opp}</b> 惜败对手。`; next = '查看结果 →'; nextCls = ''; S.finalWin = false; }
      else { verdictTxt = `两队实力相当，难分胜负——<b class="mono" style="color:var(--gold2)">${you} : ${opp}</b>，比赛被拖入<b>加时赛</b>！`; next = '进入加时赛'; nextCls = 'surv'; S.finalWin = null; }
      gq('gf-body').innerHTML = `<div class="narr big">${myLabel} <b class="mono">${S.myScore[0]}:${S.myScore[1]}</b> ＋ ${allyLabel} <b class="mono">${S.allyScore[0]}:${S.allyScore[1]}</b><br><br>${verdictTxt}</div>`;
      setAct(next, nextCls, '');
    }
    function renderOt1() {
      setHead('6', 'OVERTIME · 体力', '加时赛 · 体力检定');
      gq('gf-body').innerHTML = `<div class="narr">经过漫长的 BO5，你的体力被消耗了不少。你是否还有体力继续打加赛？
        <div class="prompt">判定对象：体力 ${Math.round(P.stamina)}（你的投掷）</div></div>
        <div class="rollzone" id="gf-rollZone"><div class="rz-top"><span class="rz-lab">D120 · 体力检定</span><span class="rz-thr">能力值 <b>${Math.round(P.stamina)}</b></span></div>
          <div class="rollbody" id="gf-rollBody"></div></div><div class="outcome" id="gf-outcome"></div>${renderBuffs()}`;
      setAct('检定体力', 'surv', '');
    }
    function doOt1() {
      animateRoll(abilityOf('stam'), true, (r) => {
        S.pendingMod = null;
        const map = {
          crit: { t: 'BO5 对你来说只是热身，打完之后你才进入了最佳状态。加时赛获得 20 点优势。', mod: () => { S.globalBuffs.push({ label: '加时·体力', delta: -20 }); } },
          good: { t: '你的体力完全够用，已经准备好面对加时赛了。加时赛获得一个优势骰。', mod: () => { S.pendingMod = 'adv'; } },
          near: { t: '你的体力还剩一些，打完比赛完全没有问题。', mod: () => { } },
          bad: { t: '你的体力所剩无几，但依旧能支撑你打完比赛。加时赛获得一个 1-6 的随机劣势。', mod: () => { S.pendingMod = 'rdis'; } },
          fumble: { t: '你的体力耗尽，完全无法正常操作。加时赛失败。', mod: () => { S.finalWin = false; } },
        }[r.tier];
        map.mod();
        const oc = gq('gf-outcome'); oc.className = 'outcome show ' + GF_OUT_STYLE[r.tier];
        oc.innerHTML = `<div class="oh"><span class="bar"></span><b>${GF_TIER_NAME[r.tier]}</b></div><div class="otxt">${map.t}</div>`;
        gq('gf-body').querySelector('.buffs').outerHTML = renderBuffs();
        if (r.tier === 'fumble') { S.phase = 'otDone'; setAct('查看结果 →', '', ''); }
        else { S.phase = 'ot1done'; setAct('打加时赛 →', 'surv', ''); }
      });
    }
    function renderOt2() {
      setHead('6', 'OVERTIME · 发挥', '加时赛 · 决胜发挥');
      const abil = abilityOf('quad');
      gq('gf-body').innerHTML = `<div class="narr">加时赛中，你们的发挥受开局与体力检定影响。
        <div class="prompt">判定对象：四维＋队友均值 ${abil}（你的投掷）</div></div>
        <div class="rollzone" id="gf-rollZone"><div class="rz-top"><span class="rz-lab">D120 · 加时发挥</span><span class="rz-thr">能力值 <b>${abil}</b></span></div>
          <div class="rollbody" id="gf-rollBody"></div></div><div class="outcome" id="gf-outcome"></div>${renderBuffs()}`;
      setAct('决胜一投', 'surv', '');
    }
    function doOt2() {
      animateRoll(abilityOf('quad'), true, (r) => {
        S.pendingMod = null;
        const map = {
          crit: { t: '你们以迅雷不及掩耳之势拿下了加时赛的胜利！', win: true },
          good: { t: '你们以比分优势获得了胜利！', win: true },
          near: { t: '你们获得了平局，但在时间上战胜了对手，赢下了比赛！', win: true },
          bad: { t: '你们获得了平局，但在时间上却没能战胜对方，最终惜败。', win: false },
          fumble: { t: '惨烈的失败，你的手伤还在比赛中不幸复发——腱鞘炎。', win: false },
        }[r.tier];
        S.finalWin = map.win;
        const oc = gq('gf-outcome'); oc.className = 'outcome show ' + GF_OUT_STYLE[r.tier];
        oc.innerHTML = `<div class="oh"><span class="bar"></span><b>${GF_TIER_NAME[r.tier]}</b></div><div class="otxt">${map.t}</div>`;
        S.phase = 'otDone'; setAct('揭晓结果 →', '', '');
      });
    }

    function finishAndResolve() {
      const fmvpIsPlayer = S.myScore[0] > S.allyScore[0] ? true : (S.myScore[0] < S.allyScore[0] ? false : (Math.random() < 0.5));
      const abnormal = S.lastOwnTier === 'fumble';
      const el = gq('gfOverlay'); if (el) el.remove();
      document.removeEventListener('keydown', onKey);
      resolve({ win: !!S.finalWin, myScore: S.myScore.slice(), allyScore: S.allyScore.slice(), fmvpIsPlayer, abnormal, overtime: !!S.wentOvertime });
    }

    /* --- 行动按钮分发 --- */
    gq('gf-act').addEventListener('click', () => {
      if (gq('gf-act').disabled) return;
      actionCount++; if (!replaying && cfg.onAction) cfg.onAction(actionCount);
      if (S.rollCtl) { S.rollCtl(); return; }
      const P0 = S.phase;
      if (P0 === 'intro') { S.phase = 'coin'; render(); }
      else if (P0 === 'coin') { if (S.coin.p === null || S.coin.p === S.coin.o) doCoin(); else { S.phase = 'state'; render(); } }
      else if (P0 === 'state') { if (S.stateDice.length < 2) doStateRoll(); else { S.phase = 'bp'; render(); } }
      else if (P0 === 'bp') { if (gq('gf-rollZone') && gq('gf-rollZone').classList.contains('show') && gq('gf-tierBadge') && gq('gf-tierBadge').innerHTML) beginPlay(); else doBP(); }
      else if (P0 === 'play') { const oc = gq('gf-outcome'); if (oc && oc.classList.contains('show')) render(); else doPlay(); }
      else if (P0 === 'playDone') { S.phase = 'half'; render(); }
      else if (P0 === 'half') { const oc = gq('gf-outcome'); if (oc && oc.classList.contains('show')) { S.phase = 'tally'; render(); } else doHalf(); }
      else if (P0 === 'tally') { if (S.finalWin === null) { S.phase = 'ot1'; S.wentOvertime = true; render(); } else finishAndResolve(); }
      else if (P0 === 'ot1') { doOt1(); }
      else if (P0 === 'ot1done') { S.phase = 'ot2'; render(); }
      else if (P0 === 'ot2') { doOt2(); }
      else if (P0 === 'otDone') { finishAndResolve(); }
    });
    gq('gf-help').addEventListener('click', () => {gq('gf-rules').classList.add('show');gq('gf-rulesX').focus();});
    gq('gf-rulesX').addEventListener('click', () => gq('gf-rules').classList.remove('show'));
    gq('gf-rules').addEventListener('click', (e) => { if (e.target === gq('gf-rules')) gq('gf-rules').classList.remove('show'); });
    function onKey(e) {
      if (e.key === 'Escape') { if (gq('gf-rules').classList.contains('show')) {gq('gf-rules').classList.remove('show');gq('gf-help').focus();} else suspend(); }
      if (e.key === 'Tab') { const area=gq('gf-rules').classList.contains('show')?gq('gf-rules'):overlay;
        const list=[...area.querySelectorAll('button:not(:disabled)')].filter(b=>b.offsetParent!==null),first=list[0],last=list.at(-1);
        if (e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();} else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();} }
    }
    document.addEventListener('keydown', onKey);

    /* --- 测试钩子：供 _uitest 在 __KO_FAST 下驱动 --- */
    if (typeof window !== 'undefined') {
      window.__gfScreen = { get phase() { return S.phase; }, clickAct: () => gq('gf-act').click() };
    }
    render();
    if (replaying) {
      const resume = () => {
        if (!gq('gfOverlay')) return;
        if (gq('gf-act').disabled) {setTimeout(resume, 5);return;}
        if (actionCount < cfg.replayActions) {gq('gf-act').click();setTimeout(resume, 5);return;}
        replaying=false;overlay.classList.remove('restoring');gq('gf-act').focus();
      }; resume();
    } else gq('gf-act').focus();
  });
}

return runGrandFinals(cfg);
};
