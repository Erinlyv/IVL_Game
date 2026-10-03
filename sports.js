/* v7.0 洲际运动会：沿用支线v1.1界面，真实生涯状态/赛事/存档接入。 */
window.IVLSports = (() => {
const ATTR=['tech','tac','phys','stab'];
function ensure(p, year=1) {
  if (p.sports && p.sports.schema===1) return p.sports;
  const enabled=Math.random()<.7, roll=Math.random();
  const weights=[.1,.1,.1,.1,.2,.2,.2]; let sum=0, noticeYear=7;
  for(let i=0;i<weights.length;i++){sum+=weights[i];if(roll<sum){noticeYear=i+1;break;}}
  p.sports={schema:1,enabled,noticeYear,seed:(Math.random()*4294967296)>>>0,
    status:noticeYear<year?'missed':'scheduled',node:'notice',player:null,group:null,candidates:[],roster:[],
    round:0,training:0,trainLog:[],qPlayed:0,mPlayed:0,koRound:0,koRoll:null,koDone:false,
    awarded:false,medal:null,result:null,log:[],tab:0,tableTab:'C',recovered:{},tieGames:[]};
  return p.sports;
}
function createSession(ctx) {
const COPY=window.SPORTS_COPY; const E=window.IVL, P=ctx.player; let S=P.sports; const controller=new AbortController(); let resolveRun;
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GROUPS=['指挥组','牵制1组（偏辅助）','牵制2组（偏ob）','救援组','监管者'];
const ATTRS={tech:'技术',tac:'战术',phys:'体能',stab:'稳定性'};
const PHASES=['通知报名','五轮选拔','深渊前训练','预选赛','国家队集训','正赛','颁奖'];
const QUAL_NOTE='CHN比赛场数：5；各组晋级名额：前 3；最佳队伍直通八强：1。';
const RATING=p=>p.tech*.4+p.tac*.35+p.phys*.15+p.stab*.1, avg=a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:0;
const clamp=n=>Math.max(0,Math.min(100,n)), fmt=n=>Number(n).toFixed(2);
const icon=(name='trophy')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='mail'?'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>':'<path d="M8 3h8v7a4 4 0 0 1-8 0V3Z"/><path d="M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8m-9-2h10"/>'}</svg>`;
function random(){S.seed=(Math.imul(S.seed,1664525)+1013904223)>>>0;return S.seed/4294967296;}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function say(key,cls='flavor'){return `<div class="${cls}">${(COPY[key]||key).split('\n').map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;}
function btn(label,action,primary=true,hint='',disabled=false){return `<button class="choice ${primary?'primary':''}" data-action="${action}" ${disabled?'disabled':''}><span class="cl">${label}</span>${hint?`<span class="ch">${hint}</span>`:''}</button>`;}
function actions(...a){return `<div class="choices">${a.join('')}</div>`;}
function head(title,note=''){return `<div class="panel-head"><h2>${title}</h2>${note?`<details class="round-note"><summary>本轮说明</summary><div class="round-note-pop">${note}</div></details>`:''}</div>`;}
function strip(items){return `<p class="plain-summary">${items.map(([v,k])=>`${k}：${v}`).join('；')}。</p>`;}
function phase(){return ({notice:0,groups:0,qualify:0,candidates:1,trial:1,selection:1,preAbyss:2,qualIntro:3,qualMatches:3,campIntro:4,camp:4,mainGroups:5,quarterIntro:5,semiIntro:5,finalIntro:5,knockout:5,koDice:5,ceremony:6,ending:6,finish:6,exit:6})[S.node]||0;}
function hud(){
  const p=S.player, idx=phase(), pct=idx/(PHASES.length-1)*100;
  const colors={tech:'var(--gold2)',tac:'var(--azure)',phys:'var(--ok)',stab:'var(--lav)',appearance:'var(--rose)'};
  const attributes={...ATTRS,appearance:'容貌'};
  const member=S.roster.some(c=>c.id==='player');
  return `<div class="hud-id"><div class="avatar">你</div><div><div class="pname">${esc(P.name)} <span class="pos">${S.role}·${S.role==='监管者'?'追击型':S.position}</span></div><div class="pmeta">${esc(P.identity)} · ${17+ctx.year}岁 · 第 ${ctx.year}/7 赛年</div><div class="pstage">阶段：${PHASES[idx]}</div></div></div>
  <div class="yearprog"><div class="yp-head"><span class="yp-yr">洲际运动会</span><span class="yp-now">${PHASES[idx]}</span></div><div class="yp-line"><i class="yp-fill" style="width:${pct}%"></i>${PHASES.map((n,i)=>`<span class="yp-tick ${i<idx?'done':i===idx?'on':''}" style="left:${i/(PHASES.length-1)*100}%" title="${n}"></span>`).join('')}<span class="yp-marker" style="left:${pct}%"></span></div></div>
  <div class="stamina"><div class="stat-top"><span>体力</span><b>${Math.round(p.stamina)} / ${Math.round(maxStamina())}</b></div><div class="track big"><i style="width:${p.stamina/maxStamina()*100}%;background:var(--ok)"></i></div></div>
  <div class="stats">${Object.entries(attributes).map(([k,n])=>`<div class="stat"><div class="stat-top"><span>${n}</span><b>${Math.round(p[k])}</b></div><div class="track"><i style="width:${p[k]}%;background:${colors[k]}"></i></div></div>`).join('')}</div>
  <div class="res"><div class="resitem"><span>人气</span><b>${p.pop.toFixed(1)} 万</b></div><div class="resitem"><span>综合评分</span><b>${fmt(RATING(p))}</b></div><div class="resitem"><span>代表队</span><b>${member?'CHN':'—'}</b></div><div class="resitem"><span>奖牌</span><b>${S.medal||'—'}</b></div></div>
  <div class="champs">所属俱乐部 ${esc(P.teamName)}${member?' ｜ 国家队首发':''}</div>
  ${member?`<div class="inv"><button class="bagbtn" data-action="roster"><span class="bagbtn-lab">国家队成员</span><span class="bagbtn-badge">7</span></button></div>`:''}`;
}
const CUP_NODES=['quarterIntro','semiIntro','finalIntro','knockout','ceremony'];
function render(focus=false){
  $('hud').innerHTML=hud()+(['qualMatches','mainGroups','quarterIntro','semiIntro','finalIntro','knockout'].includes(S.node)?'<button class="bagbtn" data-action="bag">背包</button>':'');$('log').innerHTML=S.log.slice(-20).reverse().map((l,i)=>`<div class="logline good"><span class="tag">Y${ctx.year}</span>${esc(l)}</div>`).join('');if($('logCount'))$('logCount').textContent=S.log.length;
  const cup=CUP_NODES.includes(S.node),main=$('main');
  const app=document.querySelector('.app'); if(app)app.inert=cup;
  main.className='main';main.innerHTML=cup?'':views[S.node]();
  $('competition').innerHTML=cup?tournamentView():'';
  if(cup){requestAnimationFrame(drawCupLinks);}else if(focus){main.focus({preventScroll:true});main.scrollIntoView?.({block:'start',behavior:'instant'});}
  syncMatchIntro();
  save();
}
function syncMatchIntro(force=false){
  const dialog=$('match-intro');
  if(!['quarterIntro','semiIntro'].includes(S.node)){if(dialog.open)dialog.close();return;}
  if(!force&&S.introDismissed===S.node)return;
  dialog.innerHTML=`${head(S.node==='quarterIntro'?'八强赛':'晋级四强')}<div class="panel-body">${say(S.node==='quarterIntro'?'八强赛':'晋级四强')}</div>${actions(btn('准备上场','go:knockout'),btn('查看赛程','dismissMatchIntro',false))}`;
  if(!dialog.open)dialog.showModal();
}
function score(c){return c.cp*.3+avg(c.scores)*.7;}
function trialTeam(r){const id=S.initialGroups[S.group].indexOf('player');const i=(id-S.group*r%5+5)%5;return [0,1,2,3,4].map(g=>S.candidates.find(c=>c.id===S.initialGroups[g][(i+g*r)%5]));}
function playTrial(){if(S.node!=='trial'||S.trialRevealed||S.round>=5)return;S.player.stamina=maxStamina();for(const c of S.candidates){const V=20-c.stab*.15;c.scores.push(clamp(c.cp+(random()*2-1)*V));}S.player.stamina=maxStamina()-6;S.round++;S.trialRevealed=true;const p=S.candidates.find(c=>c.id==='player');log(`选拔第${S.round}轮：个人表现 ${fmt(p.scores.at(-1))}。`);render();$('announcement').textContent=`个人表现 ${fmt(p.scores.at(-1))}，本轮结果已保存。`;}
function members(list,showScore=false){return `<div class="standings">${list.map((c,i)=>{const npc=c.id!=='player',id=c.playerId||c.name;return `<div class="stand-row ${c.id==='player'?'me':''}"><span class="st-rank">${i+1}</span><div class="st-name"><span>${esc(c.name)}${npc?` <button class="edit-player-id" type="button" data-action="editId:${esc(c.id)}" title="编辑选手ID" aria-label="编辑${esc(c.name)}的选手ID">✎</button>`:''}</span><small>${GROUPS[c.group]} · ${esc(c.club)}${typeof c.starter==='boolean'?' · '+(c.starter?'首发':'轮换'):''}${npc?` · <span class="player-id-value">ID：${esc(id)}</span>`:''}</small></div><b class="member-value">${fmt(showScore?score(c):RATING(c))}<small>${showScore?'总分':'综合评分'}</small></b></div>`;}).join('')}</div>`;}
function candidateTable(g,final=false){const a=g===5?rank(S.candidates.filter(c=>c.group<4&&!S.roster.slice(0,4).some(t=>t.id===c.id)),true):rank(S.candidates.filter(c=>c.group===g),final);return `<div class="table-wrap"><table class="data-table"><caption>${g===5?'求生者轮换名额榜':GROUPS[g]}${final?' · 总分排名':' · 资格排名'}</caption><thead><tr><th>排名</th><th>选手 / 来源</th><th>综合评分</th>${final?'<th>均分</th><th>总分</th>':''}</tr></thead><tbody>${a.map((c,i)=>`<tr class="${c.id==='player'?'me':''}"><td>${i+1}</td><td>${esc(c.name)}<br><span class="muted">${esc(c.club)}</span></td><td>${fmt(c.cp)}</td>${final?`<td>${fmt(avg(c.scores))}</td><td>${fmt(score(c))}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}
function candidateTabs(final=false){const gs=final?[...GROUPS,'求生轮换']:GROUPS;return `<div class="tabs" aria-label="候选人组别">${gs.map((g,i)=>`<button class="intbtn ${S.tab===i?'on':''}" aria-pressed="${S.tab===i}" data-action="tab:${i}">${g}</button>`).join('')}</div>${candidateTable(S.tab,final)}`;}
// Round-robin fixtures are generated once; standings use only completed matches.
function schedule(names){let ring=[...names];if(ring.length%2)ring.push(null);const out=[];for(let r=1;r<ring.length;r++){for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring[ring.length-1-i];if(a&&b)out.push({a,b,r});}ring.splice(1,0,ring.pop());}return out;}
function teamTable(group,main=false){const names=(main?S.mGroups:S.qGroups)[group],matches=(main?S.mMatches:S.qMatches).filter(m=>m.group===group),round=main?S.mPlayed:S.qPlayed;const rows=((main?S.mRanks:S.qRanks)||{})[group]||standings(names,matches,round);return `<div class="table-wrap"><table class="data-table"><caption>${group}组 · ${names.length}支队伍 · 前3晋级</caption><thead><tr><th>排名</th><th>代表队</th><th>胜/平/负</th><th>净局胜</th><th>积分</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.name==='CHN'?'me':''}"><td>${i+1}</td><td><b>${r.name}</b>${round===(main?3:5)&&i<3?' <span class="badge">晋级</span>':''}</td><td>${r.win}/${r.draw}/${r.loss}</td><td>${r.diff>0?'+':''}${r.diff}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`;}
function groupTables(main=false){const groups=main?S.mGroups:S.qGroups;if(!groups[S.tableTab])S.tableTab=Object.keys(groups)[0];return `<div class="tabs" aria-label="小组积分">${Object.keys(groups).map(g=>`<button class="intbtn ${S.tableTab===g?'on':''}" aria-pressed="${S.tableTab===g}" data-action="groupTab:${g}">${g}组</button>`).join('')}</div>${teamTable(S.tableTab,main)}`;}
function matchCard(a,b,score,sub='BO3',detail=''){return `<div class="match-card"><div class="match-top"><span>洲际运动会 · 电子竞技项目</span><span>${sub}</span></div><div class="versus"><div><div class="team-name ${a==='CHN'?'home':''}">${a}</div><div class="team-sub">${a==='CHN'?'参赛代表队':'国家和地区代表队'}</div></div><div class="score">${score||'VS'}</div><div><div class="team-name ${b==='CHN'?'home':''}">${b}</div><div class="team-sub">${b==='JP'?'东道主':'国家和地区代表队'}</div></div></div>${detail?`<div class="match-bottom">${detail}</div>`:''}</div>`;}
function groupResult(main=false){const n=main?S.mPlayed:S.qPlayed,matches=(main?S.mMatches:S.qMatches),m=matches.find(m=>m.r===n&&(m.a==='CHN'||m.b==='CHN'));if(!m)return '';const win=m.a==='CHN'?m.sa>m.sb:m.sb>m.sa;return `<div class="gline ${win?'w':'l'}">第 ${n} 场 · ${m.a} <b>${m.sa} : ${m.sb}</b> ${m.b} · ${win?'胜':'负'}<span class="gev">总得分 ${m.pa} : ${m.pb} · 体力 −6</span></div>`;}
function train(kind){if(S.node!=='camp'||S.training>=5)return;const growth=[{tech:4,phys:2},{tech:2,tac:4},{phys:4,stab:2},{tac:5,stab:5}][kind],names=['单练','团队训练','体能训练','战术复盘'];const before={...S.player};for(const[k,v]of Object.entries(growth))S.player[k]=Math.min(k==='stab'&&E.isGoldenPlayer(P)?P.golden_stab_cap:100,S.player[k]+v);for(const c of S.roster){if(c.id==='player')for(const k of Object.keys(ATTRS))c[k]=S.player[k];else {const base=[{tech:2,phys:1},{tech:1,tac:2},{phys:2,stab:1},{tac:5,stab:5}][kind];for(const[k,v]of Object.entries(base))c[k]=clamp(c[k]+v);}}S.training++;S.trainingResult=true;const changes=Object.keys(growth).map(k=>`${ATTRS[k]} +${S.player[k]-before[k]}`).join('、');S.trainLog.push({name:names[kind],changes,teamChanges:['技术 +2、体能 +1','技术 +1、战术 +2','体能 +2、稳定性 +1','战术 +5、稳定性 +5'][kind]});log(`集训 ${S.training}/5 · ${names[kind]}：${changes}。`);render();$('announcement').textContent=`${changes}，剩余${5-S.training}次训练机会。`;}
function makeKORound(r){if(r===0||S.bracket[r].length)return;for(let i=0;i<S.bracket[r-1].length;i+=2)S.bracket[r].push({a:S.bracket[r-1][i].winner,b:S.bracket[r-1][i+1].winner});}
function bracket(){return `<div class="bracket">${['八强赛','半决赛','决赛'].map((name,r)=>`<div class="bracket-col"><h3>${name} · ${r===2?'BO5':'BO3'}</h3>${(S.bracket[r].length?S.bracket[r]:Array.from({length:2**(2-r)},()=>({a:'待定',b:'待定'}))).map((m,i)=>`<div class="tie ${r===S.koRound&&(m.a==='CHN'||m.b==='CHN')?'current':''}"><div class="tie-label">${r===0?(i<2?'上半区':'下半区'):r===1?(i===0?'上半区':'下半区'):'金牌争夺战'}</div>${[m.a,m.b].map((n,j)=>`<div class="tie-row ${m.winner===n?'winner':''}"><span>${n}</span><b>${j===0?(m.sa??'—'):(m.sb??'—')}</b></div>`).join('')}</div>`).join('')}</div>`).join('')}</div>`;}
function rollBox(value,description){return `<div class="dice-stage"><div class="dice-result"><svg class="trial-die" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="40" height="40" rx="10"/>${[[15,15],[33,15],[24,24],[15,33],[33,33]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.5" fill="currentColor"/>`).join('')}</svg><div class="dice-tier">${value}</div><p class="dice-text">${description}</p></div></div>`;}
function diceFace(t){return '⚀⚁⚂⚃⚄⚅'[clamp(t)-1]||'⚅';}

const PLAYOFF_DICE_FEEDBACK=[
  {tier:1,group:'失常',sub:'严重失常',text:'手感彻底没了。开局连最熟的操作都打变形，像换了个人在打。'},
  {tier:2,group:'失常',sub:'状态低迷',text:'状态没起来，节奏总慢半拍。今天得多靠脑子、少靠手。'},
  {tier:3,group:'稳定',sub:'稳健发挥',text:'和训练赛里的你一模一样，不飘也不怵。'},
  {tier:4,group:'稳定',sub:'四平八稳',text:'稳，略偏保守。不出彩，但也不轻易给对手机会。'},
  {tier:5,group:'超常',sub:'渐入佳境',text:'手感上来了，越打越顺——这一场有机会咬下来。'},
  {tier:6,group:'超常',sub:'巅峰爆发',text:'手感爆棚！连你自己都有点不敢信今天这状态。'}
];
function award(){if(!S.awarded){const gain={金牌:20,银牌:5,铜牌:3}[S.medal]||0;S.player.pop+=gain;S.awarded=true;S.achievement={金牌:'金牌得主',银牌:'银牌得主',铜牌:'铜牌得主'}[S.medal];log(`${S.result} · ${S.medal} · 人气 +${gain}万 · 解锁${S.achievement}。`);}move('finish');}
// 复用 IVL_Game 的 #koscreen 结构与原样CSS；仅替换赛事数据和8队签表拓扑。
function cupNode(r,i,key,top){
  const m=S.bracket?.[r]?.[i]||{a:'待定',b:'待定'};
  return `<div class="node ${r===2?'final':''} ${r===S.koRound&&!m.winner&&(m.a==='CHN'||m.b==='CHN')?'current':''}" id="cup-${key}" style="top:${top}px"><div class="nh"><span class="code">${key}</span><span class="st">${r===2?'BO5':'BO3'} · ${m.winner?'已结束':'待赛'}</span></div>${[m.a,m.b].map((n,j)=>`<div class="row ${n==='CHN'?'you':''} ${n==='待定'?'tbd':''} ${m.winner?(m.winner===n?'winrow':'loserow'):''}"><span class="cc" style="--tc:${n==='CHN'?'var(--hunter)':'var(--gold2)'}">${n==='待定'?'?':n.slice(0,2)}</span><span class="rn">${n}</span><span class="rs">${j===0?(m.sa??'—'):(m.sb??'—')}</span></div>`).join('')}</div>`;
}
function cupBracket(){
  return `<div class="field" id="cup-field"><svg class="links" id="cup-links" aria-hidden="true"></svg><div class="daycols">${['四分之一决赛','半决赛','决赛','半决赛','四分之一决赛'].map((n,i)=>`<div class="daycol"><div class="d ${i===2?'fin':''}">${n}</div><div class="t">${i===2?'BO5':'BO3'}</div></div>`).join('')}</div><div class="grid"><div class="col">${cupNode(0,0,'Q1',24)}${cupNode(0,1,'Q2',270)}</div><div class="col">${cupNode(1,0,'S1',147)}</div><div class="col"><div class="champ ${S.bracket?.[2]?.[0]?.winner?'':'pending'}" style="top:0"><div class="trophy">${icon()}</div><div class="lab">CHAMPION</div><div class="who">${S.bracket?.[2]?.[0]?.winner||'待定'}</div></div>${cupNode(2,0,'FINAL',190)}<div class="cup-bronze">半决赛败者并列季军<br>不另设季军赛</div></div><div class="col">${cupNode(1,1,'S2',147)}</div><div class="col">${cupNode(0,2,'Q3',24)}${cupNode(0,3,'Q4',270)}</div></div></div>`;
}
function drawCupLinks(){
  const field=$('cup-field'),svg=$('cup-links');if(!field||!svg)return;
  const base=field.getBoundingClientRect(),scale=base.width/field.offsetWidth;
  svg.setAttribute('viewBox',`0 0 ${field.offsetWidth} ${window.innerWidth<=600?470:field.offsetHeight}`);
  svg.innerHTML=[['Q1','S1'],['Q2','S1'],['Q3','S2'],['Q4','S2'],['S1','FINAL'],['S2','FINAL']].map(([from,to])=>{const a=$('cup-'+from).getBoundingClientRect(),b=$('cup-'+to).getBoundingClientRect(),ltr=a.left<b.left;const x1=((ltr?a.right:a.left)-base.left)/scale,y1=(a.top+a.height/2-base.top)/scale,x2=((ltr?b.left:b.right)-base.left)/scale,y2=(b.top+b.height/2-base.top)/scale,x=(x1+x2)/2;return `<path d="M${x1} ${y1} H${x} V${y2} H${x2}" fill="none" stroke="rgba(245,207,106,.5)" stroke-width="1.5"/>`;}).join('');
}
function cupTeam(name){return `<div class="tcard ${name==='CHN'?'player':''}"><div class="crest" style="--tc:${name==='CHN'?'var(--hunter)':'var(--gold2)'}">${name.slice(0,2)}</div><div class="info"><div class="nm">${name}${name==='CHN'?'<span class="you">YOU</span>':''}</div><div class="rg">${name==='CHN'?'参赛代表队':name==='JP'?'东道主':'国家和地区代表队'}</div></div></div>`;}
const CUP_KNIFE=fill=>`<svg viewBox="0 0 76 18" aria-hidden="true"><circle cx="4" cy="9" r="3.4" fill="#9c8757"/><rect x="6" y="6.5" width="14" height="5" rx="2.5" fill="#5d4a28"/><rect x="20" y="2.5" width="4.5" height="13" rx="2" fill="#c9a24a"/><path d="M25 6 L66 8.2 L74 9 L66 9.8 L25 12 Z" fill="${fill}"/></svg>`;
function cupAction(label,action,kind=''){return `<button class="bigbtn ${kind}" data-action="${action}">${label}</button>`;}
function tournamentView(){
  const qual=S.node==='qualMatches',group=S.node==='mainGroups',intro=['quarterIntro','semiIntro','finalIntro'].includes(S.node),r=S.koRound;
  const stage=qual?'预选赛':group?'正赛小组赛':['八强赛','半决赛','决赛'][r];
  let m=null,title=stage,action='',story='',result='',right='',completed=0,total=1;
  if(qual||group){const matches=qual?S.qMatches:S.mMatches;completed=qual?S.qPlayed:S.mPlayed;total=qual?5:3;
    m=matches.find(m=>m.r===Math.min(completed+1,total)&&(m.a==='CHN'||m.b==='CHN'));
    if(completed<total)action=cupAction(group&&S.best==='CHN'?'查看小组赛结果':'开始下一场比赛',qual?'playQual':'playMain');
    else action=cupAction(qual?'确认预选赛结果':'确认八强名单',qual?'finishQual':'finishMain');
    story=group?`<p class="cup-note">八强直通：JP · ${S.best}${S.best==='CHN'?'。CHN仍等待其他队小组赛结束。':''}</p>`:'';
    result=(qual?groupResult():groupResult(true));
    right=`${completed===total?`<p class="declaim-em">晋级名单：${Object.values(qual?S.qRanks:S.mRanks).flatMap(rows=>rows.slice(0,3).map(t=>t.name)).join('、')}。${qual?`最佳队伍：${S.best}，直通八强。`:''}</p>`:''}${groupTables(group)}${qual&&completed===total?`<details class="notice-more"><summary>最佳队伍评选</summary><p class="muted">全胜优先 → 场均积分 → 场均净局胜 → 场均净得分</p>${Object.values(S.qRanks).map(rows=>{const t=rows[0];return `<p class="muted">${t.name} · ${t.win===t.played?'全胜':'非全胜'} · ${fmt(t.pts/t.played)} / ${fmt(t.diff/t.played)} / ${fmt(t.points/t.played)}</p>`;}).join('')}</details>`:''}${group?`<h3 class="cup-subtitle">淘汰赛晋级图</h3>${cupBracket()}`:''}`;
  }else{
    m=S.bracket?.[r]?.find(m=>m.a==='CHN'||m.b==='CHN')||S.bracket?.[2]?.[0];completed=r+(S.koDone?1:0);total=3;
    right=cupBracket();
    if(intro){action=cupAction(S.node==='finalIntro'?(S.finalClicks?'继续决赛':'进入运动会决赛'):'准备上场',S.node==='finalIntro'?'startFinal':'showMatchIntro','player');}
    else if(S.koDone){result=`<div class="result show"><div class="rh"><span class="bar"></span><b>本场结果</b><span class="score mono">${m.a} ${m.sa}:${m.sb} ${m.b}</span></div><div class="cause">${m.winner==='CHN'?(r===2?'CHN夺得金牌！':r===1?'CHN晋级决赛。':'CHN晋级四强，已确保一枚奖牌。'):(r===2?'CHN获得银牌。':r===1?'CHN获得并列季军。':'CHN止步八强。')}</div></div>`;action=cupAction('确认本场结果','nextKO','next');}
    else if(r===2){action=cupAction(S.finalClicks?'继续决赛':'进入运动会决赛','startFinal','player');}
    else action=cupAction(S.koRoll===null?'该你上场了':'带着这个状态打',S.koRoll===null?'rollKO':'playKO','player');
  }
  const cost=qual||group||r<2?6:10;
  const vs=m?`<div class="versus"><div>${cupTeam(m.a)}</div><div class="clashzone"><span class="knife left">${CUP_KNIFE('#d7dde8')}</span><span class="knife right">${CUP_KNIFE('#f5cf6a')}</span><span class="spark"></span><span class="vsword mono">VS</span></div><div>${cupTeam(m.b)}</div></div>`:'';
  const d=S.koDiceResult,dice=!qual&&!group&&!intro&&r<2&&d?`<div class="roll show" aria-live="polite"><div class="dice"><span class="die settle" data-face="${d.tier}" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="p${i+1}"></i>`).join('')}</span><span class="v mono">${Number.isFinite(d.fluct)?`${d.fluct>=0?'+':''}${d.fluct.toFixed(1)}`:d.tier}</span><span class="tier ${d.tier<=2?'tier-bad':d.tier<=4?'tier-mid':'tier-good'}">${d.sub}</span></div><div class="fb">${d.text}</div></div>`:'';
  return `<div id="koscreen" class="sports-cup"><div class="ko-top"><div class="brand"><span class="logo">IVL</span><div><div class="ttl">洲际运动会 · <b>电子竞技项目</b></div><div class="sub">INTERCONTINENTAL GAMES · CHN</div></div></div><div class="spacer"></div><button class="ko-bagbtn" data-action="roster">国家队属性</button><button class="ko-bagbtn" data-action="bag">背包</button><div class="idchip"><span class="dot"></span><div><div class="nm">${esc(P.name)}</div><div class="rk">${S.role} · CHN 首发</div></div></div></div><div class="ko-layout"><aside class="side"><div class="side-head"><div><div class="lab">LIVE · 赛况推进</div><h2>${title}</h2></div></div><div class="ko-stam"><div class="stam-top"><span class="stam-lab">体力</span><b class="mono">${Math.round(S.player.stamina)} / ${Math.round(maxStamina())}</b><span class="stam-cost">每场 −${cost}</span></div><div class="stam-track"><i style="width:${S.player.stamina/maxStamina()*100}%;background:var(--ok)"></i></div></div><div class="progress"><div class="bar"><i style="width:${completed/total*100}%"></i></div><div class="row"><span>${stage}</span><span>${qual||group?`${completed} / ${total}`:`${r===2?'BO5':'BO3'}`}</span></div></div><div class="matchcard"><div class="mc-meta"><span class="mc-day">${stage}</span><span class="mc-stage">${qual||group?'小组循环赛':'单败淘汰'}</span><span class="mc-code mono">${cost===10?'BO5':'BO3'}</span></div>${story}${vs}${dice}${result}</div><div class="actions">${action}<div class="hint">${r===2&&!qual&&!group?'洲际运动会 · 决赛':'洲际运动会 · CHN'}</div></div></aside><main class="bracketwrap"><div class="bracket-title"><span class="ico">赛事进度 <b>· ${stage}</b></span><div class="legend"><span class="adv"><i></i>胜者晋级</span><span class="drop"><i></i>败者出局</span></div></div>${right}</main></div>${S.node==='ceremony'?ceremonyModal():''}</div>`;
}
function ceremonyModal(){const gain={金牌:20,银牌:5,铜牌:3}[S.medal],key={金牌:'冠军',银牌:'亚军',铜牌:'季军'}[S.medal];return `<div class="modal show"><div class="sheet cer" role="dialog" aria-modal="true" aria-labelledby="medal-title"><div class="cer-stage"><div class="cer-ey">AWARD · 颁奖</div><div class="cer-trophy">${medalSvg()}</div><div class="cer-lab">洲际运动会 · 电子竞技项目</div><div class="cer-champ" id="medal-title">CHN · ${S.result}</div></div><div class="cer-story">${say(key,'ceremony-copy')}</div><div class="cer-rewards"><div class="cer-rw"><div class="rw-lab">奖牌</div><div class="rw-val">${S.medal}</div></div><div class="cer-rw"><div class="rw-lab">粉丝增长</div><div class="rw-val">+${gain} 万</div></div></div><div class="cup-achievement">${S.awarded?'已解锁':'成就'} · ${S.medal[0]}牌得主</div><button class="bigbtn cer-done" data-action="${S.awarded?'go:finish':'award'}">${S.awarded?'完成，返回生涯':'领取奖牌 · 返回俱乐部'}</button></div></div>`;}
function medalSvg(){return `<svg viewBox="0 0 100 120" class="cup-medal ${S.medal==='银牌'?'silver':S.medal==='铜牌'?'bronze':''}" fill="none" aria-label="${S.medal}" role="img"><path d="M21 3h19l15 45H36L21 3Zm39 0h19L64 48H45L60 3Z" fill="#c5354a"/><circle cx="50" cy="75" r="33" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="75" r="26" stroke="currentColor" opacity=".55"/><path d="m50 54 5 13 14 1-11 9 3 14-11-8-11 8 3-14-11-9 14-1 5-13Z" fill="currentColor"/></svg>`;}
function openRoster(){ $('roster-content').innerHTML=`${head('CHN · 国家队属性','4名求生者 + 1名监管者首发，全体7人保留奖牌资格。')}${members(S.roster)}<p class="muted">另4名首发队友综合评分均值：${fmt(avg(S.roster.filter(c=>c.starter&&c.id!=='player').map(RATING)))}</p>`;$('roster-dialog').showModal();}
let finalRunning=false;

const views={
notice(){return `${head('洲际运动会，启动！')}<div class="notice-stamp">${icon('mail')}洲际运动会 · 电子竞技项目</div><div class="panel-body">${say('洲际运动会，启动！')}</div>${strip([['CHN','代表国家参赛'],['5 + 2','求生者 / 监管者'],['明年','深渊结束后启程']])}${actions(btn('为国争光，舍我其谁！','signup',false),btn('我还需要沉淀，把机会留给更优秀的人吧。','decline',false))}`;},
groups(){const allow=[true,S.position!=='救人位',S.position==='ob位',S.position==='救人位'];const recommended=[S.player.tac>=Math.max(S.player.tech,S.player.phys,S.player.stab),['牵制位','辅助位'].includes(S.position),S.position==='ob位',S.position==='救人位'];const desc=['所有位置均可报名','救人位以外的位置可报名','仅ob位可报名','仅救人位可报名'];return `${head('报名组别','求生者只能报名一个组别。报名截止后不可换组重复筛选；推荐提示不额外加分。')}<div class="selection-grid">${GROUPS.slice(0,4).map((g,i)=>btn(`${g} ${recommended[i]?'<span class="badge">推荐</span>':''}`,`chooseGroup:${i}`,false,desc[i],!allow[i])).join('')}</div>${actions(btn('返回通知','go:notice',false))}`;},
qualify(){const note=`${GROUPS[S.group]}，前5名进入选拔。${S.passed?'你占用本组名额，不额外增加候选人数。':''}<br>综合评分＝技术×0.40＋战术×0.35＋体能×0.15＋稳定性×0.10。`;return `${head('资格筛选',note)}<div class="panel-body">${say('资格筛选')}<div class="declaim-em">${COPY[S.passed?'通过':'未通过']}</div></div>${strip([[fmt(RATING(S.player)),'你的综合评分'],[S.playerRank,'组内排名'],[fmt(S.qualLine),'本组入围线']])}${actions(btn(S.passed?'查看选拔名单':'返回常规生涯',S.passed?'go:candidates':'failedQualification'))}`;},
candidates(){return `${head('国家队选拔赛','25名候选人参加五轮轮换试训。共5轮，每轮5场，每位候选人每轮出场一次。<br>选拔总分＝基础综合评分×30%＋五轮个人表现均分×70%；每轮恢复满体力，禁用一次性道具与商业应援加成。')}${candidateTabs()}${actions(btn('开始第一轮试训','startTrials'))}`;},
trial(){const idx=S.trialRevealed?S.round-1:S.round,team=trialTeam(idx),p=S.candidates.find(c=>c.id==='player'),surv=avg(team.slice(0,4).map(c=>c.scores[idx]||0)),hunter=team[4].scores[idx]||0;const win=S.role==='监管者'?hunter-surv:surv-hunter;const place=rank(S.candidates.filter(c=>c.group===S.group),true).findIndex(c=>c.id==='player')+1;return `${head(`选拔赛 · 第 ${idx+1} / 5 轮`,'BO1轮换试训，个人表现独立计分。综合评分与稳定性决定试训表现区间；每轮仅抽取一次。')}<h3 class="section-label">本轮求生阵容</h3>${members(team.slice(0,4))}<h3 class="section-label">本轮监管者</h3>${members(team.slice(4))}${S.trialRevealed?`${rollBox(fmt(p.scores[idx]),`个人表现 · ${GROUPS[S.group]}暂列第${place}名`)}<div class="gline ${win>=0?'w':'l'}">试训战报：${Math.abs(win)<.001?'平':win>0?'胜':'负'} · 求生均分 ${fmt(surv)} / 监管表现 ${fmt(hunter)}<span class="gev">战报不另加选拔分 · 体力 −6</span></div><div class="trial-scores">${p.scores.map((v,i)=>`<span>第${i+1}轮 <b>${fmt(v)}</b></span>`).join('')}</div>${actions(btn(S.round===5?'公布国家队名单':'下一轮试训','nextTrial'))}`:`${rollBox('等待发挥','准备完成本轮个人发挥。')}${actions(btn('掷骰 · 完成个人发挥','trialRoll'))}`}`;},
selection(){const p=S.candidates.find(c=>c.id==='player'),selected=S.roster.find(c=>c.id==='player'),note=`5名求生者、2名监管者组成正式名单。${S.selected?`${selected&&selected.starter?'你默认出场。':''}轮换成员同样享有集训与奖牌资格。`:''}`;return `${head('国家队选拔结果',note)}<div class="declaim-em">${COPY[S.selected?'入选':'落选']}</div>${!S.selected?strip([[fmt(score(p)),'你的总分'],[fmt(S.group===4?score(S.roster.filter(c=>c.group===4)[1]):Math.min(score(S.roster.find(c=>c.group===S.group)),score(S.roster[4]))),'对应入选线'],[fmt(avg(p.scores)),'五轮均分']]):''}<h3 class="section-label">CHN · 正式参赛名单</h3>${members(S.roster,true)}<details class="notice-more"><summary>查看选拔总榜与轮换名额</summary>${candidateTabs(true)}</details>${actions(btn(S.selected?'进入深渊前训练':'返回常规生涯',S.selected?'go:preAbyss':'failedSelection'))}`;},
qualIntro(){return `${head('洲际运动会 · 预选赛',`16支代表队 · A / B / C 三组。${QUAL_NOTE}`)}<div class="panel-body">${say('预选赛')}</div>${actions(btn('进入预选赛','go:qualMatches'))}`;},
qualMatches(){const m=S.qMatches.find(m=>m.r===Math.min(S.qPlayed+1,5)&&(m.a==='CHN'||m.b==='CHN'));const opponent=m.a==='CHN'?m.b:m.a;const complete=S.qPlayed===5;return `${head('洲际运动会 · 预选赛',`C组 · 已完成 ${S.qPlayed} / 5 场 · 胜3分 / 平1分 / 负0分；${QUAL_NOTE}`)}${!complete?matchCard('CHN',opponent,null,'BO3',`<span>第 ${S.qPlayed+1} 场</span><span>本场体力消耗 <b>6</b></span>`):`<div class="declaim-em">${S.qRanks.C.findIndex(r=>r.name==='CHN')<3?'CHN晋级正赛':'CHN未能晋级正赛'} · 最佳队伍：${S.best}${S.best==='CHN'?'，直通八强':''}</div><p class="hintline">正赛名单：${Object.values(S.qRanks).flatMap(r=>r.slice(0,3).map(r=>r.name)).join('、')}，以及东道主JP。</p>`}${groupResult()}${groupTables()}${complete?`<details class="notice-more"><summary>最佳队伍评选</summary><p class="muted">全胜优先 → 场均积分 → 场均净局胜 → 场均净得分。</p>${Object.values(S.qRanks).map(rows=>{const r=rows[0];return `<p class="muted">${r.name} · ${r.win===r.played?'全胜':'非全胜'} · ${fmt(r.pts/r.played)} / ${fmt(r.diff/r.played)} / ${fmt(r.points/r.played)}</p>`;}).join('')}</details>`:''}${actions(btn(complete?'确认预选赛结果':'开始下一场比赛',complete?'finishQual':'playQual'))}`;},
campIntro(){return `${head('国家队集训','集训为期两个月，全体7名成员参加。共有5次训练机会，玩家基础属性成长翻倍，训练不消耗体力。')}<div class="panel-body">${say('集训')}</div>${actions(btn('进入训练','go:camp'))}`;},
camp(){const names=['单练','团队训练','体能训练','战术复盘'],hints=['技术 +4，体能 +2','技术 +2，战术 +4<br>队友收益作用于国家队成员','体能 +4，稳定性 +2','战术 +5，稳定性 +5'];const last=S.trainLog.at(-1);return `${head('国家队集训','属性成长永久保留 · 不消耗体力')}<div class="training-top"><span>剩余训练机会</span><span><b class="counter">${5-S.training}</b> / 5</span></div><div class="trainprojs">${names.map((n,i)=>`<button class="trainproj ${S.training===5?'disabled':''}" data-action="train:${i}" ${S.training===5?'disabled':''}><span class="tp-name">${n}</span><span class="tp-info">${hints[i]}</span></button>`).join('')}</div><p class="hintline">单练、团队训练、体能训练均按常规基础成长×2；战术复盘为最终收益。属性硬上限100。</p>${last?`<div class="training-result" role="status"><b>${last.name}完成 · ${last.changes}</b><p>本次训练 ${S.training}/5 · 体力不消耗${last.name==='团队训练'?' · 国家队队友同步成长':''}</p></div>`:''}<details class="notice-more"><summary>国家队成员与训练记录</summary>${members(S.roster)}${S.trainLog.map((l,i)=>`<p class="muted">第${i+1}次 · ${l.name} · ${l.changes}</p>`).join('')}</details>${S.training===5?actions(btn('集训结束 · 查看正赛赛程','enterMain')):''}`;},
mainGroups(){const direct=S.best==='CHN',complete=S.mPlayed===3,own=Object.keys(S.mGroups).find(g=>S.mGroups[g].includes('CHN')),m=S.mMatches.find(m=>m.r===S.mPlayed+1&&(m.a==='CHN'||m.b==='CHN'));return `${head('洲际运动会 · 赛事进度','小组赛 → 八强赛 → 半决赛 → 决赛')}<div class="stage-track"><span class="active">正赛小组赛</span><span>八强赛</span><span>半决赛</span><span>决赛</span></div><div class="declaim-em">八强直通：JP · ${S.best}</div>${direct?'<p class="flavor">CHN跳过正赛小组赛，等待其余8队决出6个八强席位。</p>':`<p class="muted">CHN所在${own}组 · 已完成 ${S.mPlayed} / 3 场</p>${!complete?matchCard('CHN',m.a==='CHN'?m.b:m.a,null,'BO3'):''}${groupResult(true)}`}${complete?`<p class="declaim-em">小组出线：${Object.values(S.mRanks).flatMap(rows=>rows.slice(0,3).map(r=>r.name)).join('、')}。</p>`:''}${groupTables(true)}${actions(btn(complete?'确认八强名单':direct?'查看正赛小组赛结果':'开始下一场比赛',complete?'finishMain':'playMain'))}`;},
quarterIntro(){return `${head('八强赛','单败淘汰 · BO3')}<div class="panel-body">${say('八强赛')}</div>${bracket()}${actions(btn('进入八强赛','go:knockout'))}`;},
semiIntro(){return `${head('晋级四强','半决赛 · 胜者进入决赛，败者并列季军')}<div class="panel-body">${say('晋级四强')}</div>${bracket()}${actions(btn('进入半决赛','go:knockout'))}`;},
finalIntro(){return `${head('决赛','CHN · 金牌争夺战')}<div class="panel-body">${say('决赛开场')}</div>${bracket()}${actions(btn('准备好了','go:knockout'))}`;},
knockout(){const r=S.koRound,m=S.bracket[r].find(m=>m.a==='CHN'||m.b==='CHN'),opp=m.a==='CHN'?m.b:m.a;return `${head('洲际运动会 · 赛事进度',`${['八强赛','半决赛','决赛'][r]} · BO5 · 单败淘汰`)}<div class="stage-track">${['正赛小组赛','八强赛','半决赛','决赛'].map((n,i)=>`<span class="${i===r+1?'active':''}">${n}</span>`).join('')}</div>${matchCard('CHN',opp,S.koDone?(m.a==='CHN'?`${m.sa} : ${m.sb}`:`${m.sb} : ${m.sa}`):null,'BO5',`<span>国家队首发综合评分 <b>${fmt(avg(S.roster.filter(c=>c.starter).map(RATING)))}</b></span><span>体力消耗 <b>10</b></span>`)}${S.koRoll!==null?rollBox(fmt(S.koRoll),'个人发挥已确定 · 本场仅抽取一次'):rollBox('等待发挥','整理好队服，准备上场。')}${S.koDone?`<div class="declaim-em">${m.winner==='CHN'?(r===2?'CHN获得冠军':r===0?'CHN晋级四强':'CHN晋级决赛'):(r===0?'CHN止步八强':r===1?'CHN获得并列季军':'CHN获得亚军')}</div>`:''}${actions(btn(S.koDone?'确认本场结果':S.koRoll===null?'掷骰 · 确定临场发挥':'开始比赛',S.koDone?'nextKO':S.koRoll===null?'rollKO':'playKO'))}<h3 class="section-label">淘汰赛晋级图</h3>${bracket()}<details class="notice-more"><summary>查看正赛小组积分</summary>${groupTables(true)}</details>`;},
ceremony(){const key={金牌:'冠军',银牌:'亚军',铜牌:'季军'}[S.medal],cls={金牌:'gold',银牌:'silver',铜牌:'bronze'}[S.medal],gain={金牌:20,银牌:5,铜牌:3}[S.medal];return `${head('颁奖典礼','洲际运动会 · 电子竞技项目')}<div class="champ-hero"><svg class="medal ${cls}" viewBox="0 0 100 120" fill="none" aria-label="${S.medal}" role="img"><path d="M21 3h19l15 45H36L21 3Zm39 0h19L64 48H45L60 3Z" fill="#ad3548"/><circle cx="50" cy="75" r="34" fill="currentColor" opacity=".12"/><circle cx="50" cy="75" r="33" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="75" r="26" stroke="currentColor" opacity=".55"/><path d="m50 54 5 13 14 1-11 9 3 14-11-8-11 8 3-14-11-9 14-1 5-13Z" fill="currentColor"/></svg><div class="champ-banner xl">CHN · ${S.result}</div><div class="champ-reward">${S.medal} · <b>人气 +${gain}万</b></div></div>${say(key,'ceremony-copy')}<div class="achievement">${icon()}<div><b>${S.awarded?'已解锁':'成就'} · ${S.medal[0]}牌得主</b><p>获得洲际运动会电子竞技项目${S.medal}</p></div></div>${actions(btn(S.awarded?'返回生涯履历':'领取奖牌 · 返回俱乐部',S.awarded?'go:finish':'award'))}`;},
exit(){const content=S.result==='八强'?say('八强出局'):S.result==='筛选未通过'?say('未通过'):S.result==='选拔落选'?say('落选'):'';return `${head('洲际运动会 · 参赛结果','本次支线结束')}<div class="abyss-out"><div class="ao-lab">CAREER RECORD</div><div class="ao-rank">${S.result}</div></div><div class="panel-body">${content}</div>${S.failureScore?strip([[S.failureScore,'你的总分'],[S.failureLine,'对应入选线'],['未入选','选拔结果']]):''}${S.champion?`<div class="champion-stamp"><small>本届最终冠军</small><strong>${S.champion}</strong></div><p class="hintline">剩余赛程已自动完成。${S.result==='八强'?'八强出局不获铜牌。':'本次未获得奖牌。'}</p>`:''}${actions(btn('返回常规生涯','go:finish'))}`;},
finish(){return `${head('返回俱乐部 · 生涯履历','洲际运动会支线已结束')}<div class="country"><span class="flag-mark" aria-label="CHN代表队">★</span><b>${S.roster.some(c=>c.id==='player')?'CHN · 国家队参赛记录':'选手选拔记录'}</b></div>${strip([[S.result||'拒绝报名','最终结果'],[S.medal||'无','运动会奖牌'],[S.awarded?`+${{金牌:20,银牌:5,铜牌:3}[S.medal]}万`:'—','人气奖励']])}${actions(...(S.medal?[btn('重看颁奖典礼','go:ceremony',false)]:[]),btn('继续生涯','returnCareer'))}`;},
};
// 日常页面遵循 IVL_Game 的 present()/trainingResultPopup() 组件结构。
// 与 IVL_Game 深渊小组赛一致：生涯主面板中的逐场战报，淘汰赛另页展示。
function groupStageView(main=false){
  const played=main?S.mPlayed:S.qPlayed,total=main?3:5,complete=played===total,direct=main&&S.best==='CHN';
  const matches=main?S.mMatches:S.qMatches,groups=main?S.mGroups:S.qGroups;
  const own=Object.keys(groups).find(g=>groups[g].includes('CHN'));
  const games=matches.filter(m=>m.r<=played&&(m.a==='CHN'||m.b==='CHN'));
  const next=matches.find(m=>m.r===played+1&&(m.a==='CHN'||m.b==='CHN'));
  const rows=own?(((main?S.mRanks:S.qRanks)||{})[own]||standings(groups[own],matches.filter(m=>m.group===own),played)):[],rank=rows.findIndex(r=>r.name==='CHN')+1,me=rows.find(r=>r.name==='CHN');
  const lines=games.map((m,i)=>{const win=m.a==='CHN'?m.sa>m.sb:m.sb>m.sa;return `<div class="gline ${win?'w':'l'}" style="animation-delay:${i*.13}s">第${i+1}场　${m.a} <b>${m.sa} : ${m.sb}</b> ${m.b} · ${win?'胜':'负'}<span class="gev">· 总得分 ${m.pa}:${m.pb}</span></div>`;}).join('');
  const summary=direct?`<p>JP 与 CHN 直通八强。你等待其余队伍决出六个晋级席位。</p>`:complete?`<p class="summary">${main?'小组赛':'预选赛'} <b>${me.win} 胜 ${me.draw} 平 ${me.loss} 负</b>，小组 <b>第 ${rank} 名</b>（前 3 晋级）。</p><p class="${rank<=3?'ok':'muted'}">${rank<=3?(main?'CHN晋级八强。':'CHN晋级正赛。'):(main?'CHN未能进入淘汰赛。':'CHN未能晋级正赛。')}</p>`:`<p>${own}组 · 已完成 ${played} / ${total} 场</p><p class="flavor">下一场：CHN 对阵 ${next.a==='CHN'?next.b:next.a}。</p>`;
  return `${head('洲际运动会 · '+(main?'小组赛':'预选赛')+(complete?'战报':''),main?'':QUAL_NOTE)}<div class="panel-body">${lines?`<div class="gamelog stream">${lines}</div>`:''}${summary}${complete?`<p class="muted">晋级名单：${Object.values(main?S.mRanks:S.qRanks).flatMap(r=>r.slice(0,3).map(t=>t.name)).join('、')}。${main?'':`最佳队伍：${S.best}，直通八强。`}</p>`:''}<details class="notice-more"><summary>查看小组积分</summary>${groupTables(main)}</details></div>${actions(btn(complete?(main?'确认八强名单':'确认预选赛结果'):direct?'查看小组赛结果':'开始下一场比赛',complete?(main?'finishMain':'finishQual'):(main?'playMain':'playQual')))}`;
}
views.qualMatches=()=>groupStageView(false);
views.mainGroups=()=>groupStageView(true);
views.notice=()=>`${head('洲际运动会，启动！')}<div class="panel-body">${say('洲际运动会，启动！')}</div>${actions(btn('为国争光，舍我其谁！','signup',false),btn('我还需要沉淀，把机会留给更优秀的人吧。','decline',false))}`;
views.camp=()=>{
  const names=['单练','团队训练','体能训练','战术复盘'],hints=['技术+4，体能+2','技术+2，战术+4','体能+4，稳定+2','战术+5，稳定+5'],last=S.trainLog.at(-1);
  if(S.trainingResult&&last)return `${head(last.name+'完成')}<div class="panel-body"><p class="ok">${last.changes}</p><p>国家队其他成员：${last.teamChanges}（受属性上限限制）</p><p class="muted">本次训练不消耗体力。剩余 ${5-S.training} 次训练机会。</p></div>${actions(btn('关闭','closeTraining'))}`;
  return `${head(`集训 · 第 ${Math.min(S.training+1,5)}/5 次`,'国家队集训为期两个月。国家队其他成员获得未翻倍的基础成长；战术复盘＋5／＋5为最终收益。')}<div class="panel-body"><div class="train-stack"><div class="intensity">训练效果：<b>玩家基础成长×2</b><span class="int-hint">不消耗体力 · 剩余 ${5-S.training} 次</span></div><div class="trainprojs">${names.map((n,i)=>`<button class="trainproj ${S.training===5?'disabled':''}" data-action="train:${i}" ${S.training===5?'disabled':''}><span class="tp-name">${n}</span><span class="tp-info">${hints[i]}，体力−0</span></button>`).join('')}</div></div></div><details class="notice-more training-log"><summary>国家队成员与训练记录</summary>${members(S.roster)}${S.trainLog.map((l,i)=>`<p class="muted">第${i+1}次 · ${l.name}：你 ${l.changes}；队友 ${l.teamChanges}</p>`).join('')}</details>${S.training===5?actions(btn('集训结束 · 查看正赛赛程','enterMain')):''}`;
};

function beginIdEdit(id){
  const c=S.roster.find(x=>x.id===id); if(!c||c.id==='player')return;
  const row=[...document.querySelectorAll('.edit-player-id')].find(b=>b.dataset.action==='editId:'+id)?.closest('.st-name');
  const label=row?.querySelector('.player-id-value'); if(!label||row.querySelector('.player-id-input'))return;
  const current=c.playerId||c.name, input=document.createElement('input');
  input.className='player-id-input'; input.type='text'; input.value=current; input.maxLength=32; input.setAttribute('aria-label',`${c.name}的选手ID`);
  label.replaceWith(input); input.focus(); input.select();
  let done=false;
  const commit=()=>{
    if(done)return; const value=input.value.trim();
    if(!value){$('announcement').textContent='选手ID不能为空。';input.focus();return;}
    if(value===String(P.playerId).trim()||S.roster.some(x=>x.id!==id&&String(x.playerId||x.name).trim()===value)){$('announcement').textContent='该选手ID已被占用，请换一个。';input.focus();input.select();return;}
    done=true;c.playerId=value;log(`${c.name} 的选手ID已改为 ${value}。`);save();render();
  };
  input.addEventListener('blur',commit,{once:false});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}else if(e.key==='Escape'){done=true;input.replaceWith(label);}});
}

const handlers={
signup(){if(S.role==='监管者'){S.group=4;makeCandidates();move('qualify');}else move('groups');},
decline(){S.result='拒绝报名';log('拒绝报名，回归常规环节。');move('finish');},
failedQualification(){exit('筛选未通过');},failedSelection(){exit('选拔落选');},
editId(id){beginIdEdit(id);},
startTrials(){S.player.stamina=maxStamina();move('trial');},trialRoll:playTrial,
nextTrial(){if(!S.trialRevealed)return;if(S.round===5){selectionRoster();move('selection');}else{S.trialRevealed=false;S.player.stamina=maxStamina();move('trial');}},

playQual(){if(S.qPlayed>=5)return;S.qPlayed++;S.player.stamina=Math.max(0,S.player.stamina-6);const m=S.qMatches.find(m=>m.r===S.qPlayed&&(m.a==='CHN'||m.b==='CHN'));log(`预选赛：${m.a} ${m.sa}:${m.sb} ${m.b}。`);render();},finishQual,
enterMain(){if(S.training!==5)return;initMain();log('集训结束，进入正赛。');move('mainGroups');},
playMain(){if(S.mPlayed>=3)return;if(S.best==='CHN'){S.mPlayed=3;log('正赛两组比赛结束，六支代表队晋级八强。');}else{S.mPlayed++;S.player.stamina=Math.max(0,S.player.stamina-6);const m=S.mMatches.find(m=>m.r===S.mPlayed&&(m.a==='CHN'||m.b==='CHN'));log(`正赛小组赛：${m.a} ${m.sa}:${m.sb} ${m.b}。`);}render();},
finishMain(){const own=Object.values(S.mRanks).find(rs=>rs.some(r=>r.name==='CHN'));if(own&&own.findIndex(r=>r.name==='CHN')>2)return exit('正赛小组出局');initKO();log('八强名单已确定。JP与最佳队伍分处不同半区。');move('quarterIntro');},
rollKO,playKO,nextKO,award,returnCareer:complete
};
document.addEventListener('click',e=>{if(!document.body.classList.contains("sports-active"))return;const el=e.target.closest('button[data-action]');if(!el||el.disabled)return;const[a,v]=el.dataset.action.split(':');if(a==='bag'){if(S.koRoll!==null||S.finalClicks||!['qualMatches','mainGroups','quarterIntro','semiIntro','finalIntro','knockout'].includes(S.node))return;Promise.resolve(ctx.bag?.()).then(()=>{pull();render();});}else if(a==='go')move(v);else if(a==='chooseGroup'){const n=Number(v),valid=[true,S.position!=='救人位',S.position==='ob位',S.position==='救人位'][n];if(!valid)return;S.group=n;makeCandidates();move('qualify');}else if(a==='train')train(Number(v));else if(a==='tab'){S.tab=Number(v);const detail=el.closest('details');render();if(detail)($('main').querySelector('details')||$('competition').querySelector('details'))?.setAttribute('open','');}else if(a==='groupTab'){S.tableTab=v;const detail=el.closest('details');render();if(detail)($('main').querySelector('details')||$('competition').querySelector('details'))?.setAttribute('open','');}else if(a==='showMatchIntro')syncMatchIntro(true);else if(a==='dismissMatchIntro'){S.introDismissed=S.node;$('match-intro').close();save();}else if(a==='roster')openRoster();else if(a==='closeTraining'){S.trainingResult=false;render(true);}else if(a==='startFinal')startFinal();else if(handlers[a])handlers[a]();},{signal:controller.signal});
// Production adapters. All random/results live inside the career's saved state.
function maxStamina(){return P.stamina_max;}
function pull(){S.player={id:'player',name:P.playerId,club:P.teamName,appearance:P.appearance,...Object.fromEntries([...ATTR,'stamina','pop'].map(k=>[k,P[k]]))};if(!S.selected){S.role=P.role;S.position={qz:'牵制位',fz:'辅助位',ob:'ob位',jr:'救人位'}[P.position]||'牵制位';S.positionKey=P.position;}const c=S.roster.find(c=>c.id==='player');if(c)for(const k of ATTR)c[k]=P[k];}
function sync(){for(const k of [...ATTR,'stamina','pop'])if(Number.isFinite(S.player?.[k]))P[k]=S.player[k];P._clamp();if(S.player)for(const k of [...ATTR,'stamina','pop'])S.player[k]=P[k];const member=S.roster.find(c=>c.id==='player');if(member)for(const k of ATTR)member[k]=P[k];}
function save(){sync();if(S.awarded)ctx.achievement?.();ctx.save?.();}
function log(text){S.log.push(text);ctx.log?.(text);}
function recover(key){if(S.recovered[key])return;S.player.stamina=Math.min(maxStamina(),S.player.stamina+60);S.recovered[key]=true;}
function move(node){
 if(node==='preAbyss'){S.status='selected';S.node='waitingAbyss';S.skipSummerYear=ctx.year+1;save();return complete();}
 if(node==='camp'){S.node=node;} else S.node=node;
 S.tab=0;save();render(true);
}
function complete(){
 if(S.node==='finish')S.status='completed';
 save();window.IVLSports.active=null;controller.abort();window.removeEventListener('resize',drawCupLinks);
 for(const id of ['competition','match-intro','roster-dialog','announcement','sports-save-status'])$(id)?.remove();
 document.body.classList.remove('sports-active');const app=document.querySelector('.app');if(app)app.inert=false;
 ctx.hud?.();resolveRun?.(S);return S;
}
function makeCandidates(){
 if(S.candidates.length)return;
 const clubs=[...new Set([...(ctx.teams.cn||[]),ctx.teams.fixed].filter(Boolean))].filter(n=>n!==P.teamName);
 if(!clubs.length)clubs.push(P.teamName);
 const pools=GROUPS.map((g,gi)=>Array.from({length:Math.max(5,clubs.length)},(_,i)=>{
  const club=clubs[i%clubs.length],L=ctx.teams.meta?.[club]?.base??E.teamBaseStrength(club);
  const c={id:`sports-${gi}-${i}`,club,group:gi,scores:[],lot:random()};
  for(const k of ATTR)c[k]=clamp(Math.ceil(L-5)+Math.floor(random()*(Math.floor(L+5)-Math.ceil(L-5)+1)));
  c.cp=RATING(c);return c;
 }));
 const p={...S.player,group:S.group,cp:RATING(S.player),scores:[],lot:random()};pools[S.group].push(p);
 S.playerRank=rank(pools[S.group]).findIndex(c=>c.id==='player')+1;S.qualLine=rank(pools[S.group])[4].cp;S.passed=S.playerRank<=5;
 S.candidates=pools.flatMap(pool=>shuffle(rank(pool).slice(0,5)));
 S.candidates.forEach((c,i)=>{if(c.id!=='player')c.name=['指挥','牵制1','牵制2','救援','监管者'][c.group]+'候选人'+(i%5+1);});
 S.initialGroups=GROUPS.map((g,i)=>S.candidates.filter(c=>c.group===i).map(c=>c.id));
 log(S.passed?'资格筛选通过，入围25人选拔名单。':'资格筛选未通过。');
}
function finalCompare(a,b){return score(b)-score(a)||avg(b.scores)-avg(a.scores)||Math.min(...b.scores)-Math.min(...a.scores)||b.cp-a.cp;}
function rank(a,final=false){return [...a].sort((a,b)=>(final?finalCompare(a,b)||((S.selectionTies||{})[a.id]??999)-((S.selectionTies||{})[b.id]??999):b.cp-a.cp||b.tac-a.tac||b.stab-a.stab)||a.lot-b.lot);}
function selectRank(list,count){
 let ranked=rank(list,true),edge=ranked[count-1];
 if(ranked[count]&&finalCompare(edge,ranked[count])===0){
  const tied=ranked.filter(c=>finalCompare(c,edge)===0);S.selectionTies||={};
  let remaining=[...tied],ordered=[];
  // Continuous draws are practically unique; bounded fallback prevents a corrupt RNG hanging a save.
  for(let attempt=0;attempt<64&&remaining.length;attempt++){
   S.player.stamina=maxStamina();const draws=remaining.map(c=>({c,v:clamp(c.cp+(random()*2-1)*(20-c.stab*.15))})).sort((a,b)=>b.v-a.v);
   S.selectionExtra||=[];S.selectionExtra.push(draws.map(d=>({id:d.c.id,score:d.v})));
   if(remaining.some(c=>c.id==='player'))S.player.stamina=Math.max(0,maxStamina()-6);
   if(new Set(draws.map(d=>d.v)).size===draws.length){ordered.push(...draws.map(d=>d.c));remaining=[];}
  }
  if(remaining.length)ordered.push(...remaining.sort((a,b)=>a.lot-b.lot));
  ordered.forEach((c,i)=>S.selectionTies[c.id]=i);ranked=rank(list,true);
  log('入选线同分，已完成个人发挥加试并保存结果。');
 }
 return ranked.slice(0,count);
}
function selectionRoster(){
 if(S.roster.length)return;
 const tops=[0,1,2,3].map(g=>selectRank(S.candidates.filter(c=>c.group===g),1)[0]);
 const wild=selectRank(S.candidates.filter(c=>c.group<4&&!tops.includes(c)),1)[0];
 const hunters=selectRank(S.candidates.filter(c=>c.group===4),2);
 S.roster=[...tops,wild,...hunters].map(c=>({...c,starter:tops.includes(c)||c===hunters[0]}));
 const p=S.roster.find(c=>c.id==='player');if(p&&!p.starter)S.roster.filter(c=>c.group===p.group).forEach(c=>c.starter=c.id==='player');
 S.selected=!!p;log(S.selected?'入选CHN：5名求生者、2名监管者。':'选拔落选，本次参赛支线结束。');
}
function fixture(names,group){return schedule(names).map(m=>({...m,group,done:false}));}
function base(name){if(name==='CHN')return avg(S.roster.filter(c=>c.starter).map(c=>c.id==='player'?RATING(S.player):RATING(c)));return S.strengths[name];}
function tieOrder(names,key){
 S.tieOrders||={};if(S.tieOrders[key])return S.tieOrders[key];
 function order(list){
  if(list.length<2)return list;
  const round=shuffle(list),wins=[],loss=[];
  for(let i=0;i<round.length;i+=2){if(!round[i+1]){wins.push(round[i]);continue;}
   const m={a:round[i],b:round[i+1],tie:true,done:false};simulate(m,1,null,false);S.tieGames.push(m);
   wins.push(m.winner);loss.push(m.winner===m.a?m.b:m.a);
  }
  return [...order(wins),...order(loss)];
 }
 return S.tieOrders[key]=order(names);
}
function standings(names,matches,round=99,final=false,key=''){
 const done=matches.filter(m=>m.done&&m.r<=round),rows=names.map(name=>({name,played:0,win:0,draw:0,loss:0,pts:0,diff:0,points:0}));
 function totals(row,games){for(const m of games){if(m.a!==row.name&&m.b!==row.name)continue;const a=m.a===row.name,x=a?m.sa:m.sb,y=a?m.sb:m.sa;row.played++;row.diff+=x-y;row.points+=(a?m.pa-m.pb:m.pb-m.pa);if(x>y){row.win++;row.pts+=3;}else if(x===y){row.draw++;row.pts++;}else row.loss++;}return row;}
 rows.forEach(r=>totals(r,done));const mini={};
 for(const row of rows){const tied=rows.filter(r=>r.pts===row.pts).map(r=>r.name);mini[row.name]=totals({name:row.name,played:0,win:0,draw:0,loss:0,pts:0,diff:0,points:0},done.filter(m=>tied.includes(m.a)&&tied.includes(m.b)));}
 const cmp=(a,b)=>b.pts-a.pts||mini[b.name].pts-mini[a.name].pts||mini[b.name].diff-mini[a.name].diff||b.diff-a.diff||b.points-a.points;
 rows.sort((a,b)=>cmp(a,b)||S.teamLots[a.name]-S.teamLots[b.name]);
 if(final)for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&cmp(rows[i],rows[j])===0)j++;if(j-i>1&&i<3){const tie=rows.slice(i,j),order=tieOrder(tie.map(r=>r.name),`${key}:${tie.map(r=>r.name).sort().join(',')}`);rows.splice(i,j-i,...tie.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name)));}i=j;}
 return rows;
}
function matchAbility(fluct,cost){
 sync();P.stamina=Math.max(0,P.stamina-cost);S.player.stamina=P.stamina;
 const V=20-P.stab*.15,noBad=!!P.nextNoBadRoll;
 const float=fluct??(noBad?(-V/3+random()*4*V/3):(random()*2-1)*V);
 const proxy=Object.create(P);proxy._abyss_fatigue=0;
 const f=E.computeF(proxy,'运动会',80,ctx.year,0,0,P.nextGameBuff||0,float,noBad).F;
 P.nextGameBuff=0;P.nextNoBadRoll=false;
 const share=typeof P.score_share==='number'?Math.max(0,Math.min(1,P.score_share)):.8;
 return share*f+(1-share)*avg(S.roster.filter(c=>c.starter&&c.id!=='player').map(RATING));
}
function simulate(m,bo=3,fluct=null,auto=false){
 if(m.done)return m;
 const chn=m.a==='CHN'||m.b==='CHN',controlled=chn&&!auto&&S.selected&&!S.eliminated;
 const ability=controlled?matchAbility(fluct,bo===5?10:6):null;
 // Same mean/SD form model as regular NPC matches, but nation base never re-rolls
 // or receives club year drift. The player's F already includes their single roll.
 const form=n=>clamp(base(n)+Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random())*8);
 const a=controlled&&m.a==='CHN'?ability:(controlled?base(m.a):form(m.a));
 const b=controlled&&m.b==='CHN'?ability:(controlled?base(m.b):form(m.b));
 let delta=a-b;if(controlled&&P.stamina<=0)delta=m.a==='CHN'?-100:100;
 const winner=delta>0?m.a:delta<0?m.b:null;
 m.teamA=a;m.teamB=b;m.sa=0;m.sb=0;m.pa=0;m.pb=0;m.maps=[];
 if(!winner&&bo>1&&!m.knockout){m.maps=[[4,4]];}
 else {
  let win=winner===m.a;
  if(!winner){win=random()<.5;m.overtime=true;if(controlled){P.stamina=Math.max(0,P.stamina-6);S.player.stamina=P.stamina;}}
  const target=bo===5?3:bo===1?1:2,loser=bo===1?0:Math.abs(delta)>=8?0:target-1;
  for(let i=0;i<loser;i++)m.maps.push(win?[3,5]:[5,3]);
  for(let i=0;i<target;i++)m.maps.push(win?(Math.abs(delta)>=8?[7,1]:[5,3]):(Math.abs(delta)>=8?[1,7]:[3,5]));
 }
 for(const score of m.maps){m.pa+=score[0];m.pb+=score[1];if(score[0]>score[1])m.sa++;else if(score[1]>score[0])m.sb++;}
 m.winner=m.sa===m.sb?null:m.sa>m.sb?m.a:m.b;m.done=true;
 if(controlled&&m.winner==='CHN'&&(P.temp_active||P.teno_active))P.injured_win++;
 return m;
}
function initTournament(){
 if(S.qGroups)return;
 const medium=['KOR','TPE','HK','THA'],weak=['PHI','MAS','MGL','KGZ','KAZ','INA','TJK','SGP','VIE','LAO','SRI'];
 S.strengths={JP:75+Math.floor(random()*11),CHN:base('CHN')};
 for(const n of medium)S.strengths[n]=55+Math.floor(random()*16);
 for(const n of weak)S.strengths[n]=40+Math.floor(random()*16);
 S.teamLots=Object.fromEntries(Object.keys(S.strengths).map(n=>[n,random()]));
 const ranked=[...medium,...weak].sort((a,b)=>S.strengths[b]-S.strengths[a]||S.teamLots[a]-S.teamLots[b]);
 S.qGroups={A:[],B:[],C:['CHN']};for(let i=0;i<15;i+=3){const tier=shuffle(ranked.slice(i,i+3));Object.keys(S.qGroups).forEach((g,j)=>S.qGroups[g].push(tier[j]));}
 S.qMatches=Object.entries(S.qGroups).flatMap(([g,ns])=>fixture(ns,g));recover('qualifier');S.tableTab='C';
}
function crossCompare(a,b){return Number(b.win===b.played)-Number(a.win===a.played)||b.pts/b.played-a.pts/a.played||b.diff/b.played-a.diff/a.played||b.points/b.played-a.points/a.played;}
function finalizeGroups(main){
 const groups=main?S.mGroups:S.qGroups,matches=main?S.mMatches:S.qMatches;
 const ranks=Object.fromEntries(Object.entries(groups).map(([g,ns])=>[g,standings(ns,matches.filter(m=>m.group===g),99,true,(main?'main':'qual')+g)]));
 if(main)S.mRanks=ranks;
 else {S.qRanks=ranks;const winners=Object.values(ranks).map(r=>r[0]).sort(crossCompare);const tied=winners.filter(r=>crossCompare(r,winners[0])===0);S.best=tied.length>1?tieOrder(tied.map(r=>r.name),'best')[0]:winners[0].name;}
}
function playGroups(main,auto=false){
 const key=main?'mPlayed':'qPlayed',total=main?3:5,ms=main?S.mMatches:S.qMatches;
 if(S[key]>=total)return;
 const target=auto||(main&&S.best==='CHN')?total:S[key]+1;
 for(let r=S[key]+1;r<=target;r++){for(const m of ms.filter(m=>m.r===r))simulate(m,3,null,auto);S[key]=r;}
 if(S[key]===total)finalizeGroups(main);
 const m=ms.find(m=>m.r===S[key]&&(m.a==='CHN'||m.b==='CHN'));
 log(m?`${main?'正赛小组赛':'预选赛'}：${m.a} ${m.sa}:${m.sb} ${m.b}。`:'正赛小组赛完成，六支代表队进入八强。');
}
function finishQual(){
 if(S.qPlayed!==5)return;
 const place=S.qRanks.C.findIndex(r=>r.name==='CHN')+1;if(place>3)return exit('预选赛出局');
 log(`预选赛C组第${place}，晋级正赛。最佳队伍：${S.best}。`);S.player.stamina=maxStamina();S.recovered.camp=true;move('campIntro');
}
function initMain(){
 if(S.mGroups)return;
 const entrants=Object.entries(S.qRanks).flatMap(([g,rows])=>rows.slice(0,3).map((r,i)=>({...r,oldGroup:g,place:i}))).filter(r=>r.name!==S.best).sort((a,b)=>a.place-b.place||crossCompare(a,b)||S.teamLots[a.name]-S.teamLots[b.name]);
 const combos=[];for(let mask=0;mask<16;mask++){const A=[],B=[];for(let t=0;t<4;t++){A.push(entrants[2*t+((mask>>t)&1)]);B.push(entrants[2*t+1-((mask>>t)&1)]);}let cost=0;for(const list of [A,B])for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(list[i].oldGroup===list[j].oldGroup)cost++;combos.push({A,B,cost});}
 const min=Math.min(...combos.map(c=>c.cost)),pick=shuffle(combos.filter(c=>c.cost===min))[0];S.mGroups={A:pick.A.map(r=>r.name),B:pick.B.map(r=>r.name)};
 S.mMatches=Object.entries(S.mGroups).flatMap(([g,ns])=>fixture(ns,g));S.tableTab=Object.keys(S.mGroups).find(g=>S.mGroups[g].includes('CHN'))||'A';if(S.best!=='CHN'&&!S.eliminated)recover('groups');
}
function initKO(){
 if(S.bracket)return;const A=S.mRanks.A,B=S.mRanks.B;
 S.bracket=[[{a:'JP',b:B[2].name},{a:A[0].name,b:B[1].name},{a:S.best,b:A[2].name},{a:B[0].name,b:A[1].name}],[],[]];
 if(!S.eliminated)recover('quarter');
}
function settleKO(r,auto=false){
 makeKORound(r);for(const m of S.bracket[r]){m.knockout=true;simulate(m,r===2?5:3,S.koDiceResult?.fluct,auto);}
 if(r<2)makeKORound(r+1);
}
function rollKO(){
 if(S.node!=='knockout'||S.koRoll!==null)return;
 const V=20-S.player.stab*.15,fluct=P.nextNoBadRoll?-V/3+random()*4*V/3:(random()*2-1)*V,tier=Math.max(1,Math.min(6,Math.floor((fluct+V)/(2*V/6))+1));
 S.koRoll=clamp(RATING(S.player)+fluct);S.koDiceResult={...PLAYOFF_DICE_FEEDBACK[tier-1],fluct};
 log(`${S.koRound===0?'八强赛':'半决赛'} · 临场状态第${tier}档（${S.koDiceResult.group}）。`);render();
}
function playKO(){if(S.node!=='knockout'||S.koRoll===null||S.koDone)return;settleKO(S.koRound);S.koDone=true;const m=S.bracket[S.koRound].find(m=>m.a==='CHN'||m.b==='CHN');log(`${['八强赛','半决赛','决赛'][S.koRound]}：${m.a} ${m.sa}:${m.sb} ${m.b}。`);render();}
function nextKO(){
 if(!S.koDone)return;const m=S.bracket[S.koRound].find(m=>m.a==='CHN'||m.b==='CHN');
 if(m.winner!=='CHN'){
  S.eliminated=true;if(S.koRound===0)return exit('八强');
  S.medal=S.koRound===1?'铜牌':'银牌';S.result=S.koRound===1?'并列季军':'亚军';
  for(let r=S.koRound+1;r<3;r++)settleKO(r,true);S.champion=S.bracket[2][0].winner;return move('ceremony');
 }
 if(S.koRound===2){S.medal='金牌';S.result='冠军';S.champion='CHN';return move('ceremony');}
 S.koRound++;S.koRoll=null;S.koDiceResult=null;S.koDone=false;recover(S.koRound===1?'semi':'final');move(S.koRound===1?'semiIntro':'finalIntro');
}
function exit(result){
 S.result=result;S.medal=null;S.eliminated=true;
 if(S.qGroups){if(!S.mGroups)initMain();if(S.mPlayed<3)playGroups(true,true);if(!S.bracket)initKO();for(let r=0;r<3;r++)settleKO(r,true);S.champion=S.bracket[2][0].winner;}
 log(`本次支线结束：${result}。`);move('exit');
}
async function startFinal(){
 if(finalRunning||S.koDone)return;finalRunning=true;S.node='knockout';
 if(!S.finalSeed)S.finalSeed=Math.floor(random()*4294967296)||1;
 if(!S.finalPlayer){sync();S.finalPlayer={...P.toJSON(),cp:P.cp,stamina:Math.max(0,P.stamina-10)};delete S.finalPlayer.sports;delete S.finalPlayer._careerCheckpoint;S.finalAlly=avg(S.roster.filter(c=>c.starter&&c.id!=='player').map(RATING));}
 save();render();const m=S.bracket[2][0];
 const fp={...S.finalPlayer,role:S.role,position:S.positionKey||P.position,teamName:'CHN',teamNpc:()=>S.finalAlly};
 try{
 const result=await window.IVLSportsFinals({player:fp,year:ctx.year,youName:'CHN',oppName:m.a==='CHN'?m.b:m.a,seed:S.finalSeed,replayActions:S.finalClicks||0,intro:COPY['决赛开场'].split('\n').map(esc).join('<br>'),onAction:n=>{S.finalClicks=n;save();}});
 if(result.paused){save();render();return;}
 S.finalResult=result;m.winner=result.win?'CHN':(m.a==='CHN'?m.b:m.a);
 const you=result.myScore[0]+result.allyScore[0],opp=result.myScore[1]+result.allyScore[1];m.pa=m.a==='CHN'?you:opp;m.pb=m.b==='CHN'?you:opp;m.sa=m.pa;m.sb=m.pb;m.overtime=result.overtime;m.done=true;S.koDone=true;
 S.player.stamina=Math.max(0,S.player.stamina-10-(result.overtime?6:0));
 log(`运动会决赛：${m.a} ${m.sa}:${m.sb} ${m.b}${result.overtime?'，加时赛':''}，${m.winner}获胜。`);save();render();
 }finally{finalRunning=false;}
}
// Use finalized tie-break ranking when showing a completed group.

function groupRanks(main,g){return (main?S.mRanks:S.qRanks)?.[g]||standings((main?S.mGroups:S.qGroups)[g],(main?S.mMatches:S.qMatches).filter(m=>m.group===g),main?S.mPlayed:S.qPlayed);}
handlers.playQual=()=>{playGroups(false);render();};handlers.playMain=()=>{playGroups(true);render();};
handlers.enterMain=()=>{if(S.training!==5)return;initMain();log('集训结束，进入正赛。');move('mainGroups');};
handlers.finishMain=()=>{if(S.mPlayed!==3)return;const own=Object.values(S.mRanks).find(rs=>rs.some(r=>r.name==='CHN'));if(own&&own.findIndex(r=>r.name==='CHN')>2)return exit('正赛小组出局');initKO();log('八强名单已确定。JP与最佳队伍分处不同半区。');move('quarterIntro');};

function mount(){
 document.body.classList.add('sports-active');
 for(const [id,tag] of [['competition','div'],['match-intro','dialog'],['roster-dialog','dialog'],['announcement','div']])if(!$(id)){const el=document.createElement(tag);el.id=id;document.body.appendChild(el);}
 $('announcement').className='sr-only';$('announcement').setAttribute('aria-live','polite');
 $('roster-dialog').innerHTML='<div id="roster-content"></div><button class="intbtn" id="roster-close">关闭</button>';
 $('roster-close').onclick=()=>$('roster-dialog').close();
 $('match-intro').addEventListener('cancel',()=>{S.introDismissed=S.node;save();},{signal:controller.signal});
 window.addEventListener('resize',drawCupLinks);
 return new Promise(resolve=>{resolveRun=resolve;pull();render(true);});
}
return {mount,state:S,save,pull,makeCandidates,selectionRoster,playTrial,initTournament,playGroups,initMain,initKO,settleKO,simulate,standings,train,award,finishQual,rank,base,complete};
}
async function run(ctx){
 const s=ensure(ctx.player,ctx.year);if(ctx.phase==='selection'){
  if(s.status!=='selecting'){if(!s.enabled||s.status!=='scheduled'||s.noticeYear!==ctx.year)return;s.status='selecting';s.node='notice';}
 }else if(ctx.phase==='tournament'){
  if(s.status!=='tournament'){if(s.status!=='selected')return;s.status='tournament';s.node='qualIntro';}
 }
 const session=createSession(ctx);window.IVLSports.active=session;session.pull();
 if(s.status==='tournament'&&!s.qGroups)session.initTournament();
 return session.mount();
}
return {ensure,run,createSession};
})();
