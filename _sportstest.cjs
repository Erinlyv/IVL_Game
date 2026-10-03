const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<body><div class="app"><div id="hud"></div><div id="log"></div><div id="logCount"></div><div id="main" tabindex="-1"></div></div><div id="competition"></div><div id="announcement"></div><dialog id="match-intro"></dialog></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sports.test'});
const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
for(const f of ['engine.js','sports-copy.js','sports.js'])w.eval(fs.readFileSync(path.join(__dirname,f),'utf8'));
const E=w.IVL,A=w.IVLSports;let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
function setup(seed=1,role='求生者',level=90){const p=new E.Player('青训','TestClub','Tester',role);p.position=role==='监管者'?'zj':'qz';for(const k of ['tech','tac','phys','stab'])p[k]=level;p.stamina=p.stamina_max;p.sports=A.ensure(p);Object.assign(p.sports,{enabled:true,noticeYear:7,status:'selecting',node:'notice',seed,group:role==='监管者'?4:1});const teams=E.generateTeams(p.teamName);teams.meta=E.buildTeamMeta(teams);const c={player:p,teams,year:7,save(){},log(){}};const api=A.createSession(c);api.pull();api.makeCandidates();return {p,s:p.sports,api,c};}
for(let seed=1;seed<=80;seed++){
 const {p,s,api}=setup(seed,seed%2?'求生者':'监管者');
 ok(s.candidates.length===25,'25 candidates');for(let g=0;g<5;g++)ok(s.candidates.filter(x=>x.group===g).length===5,'5 per group');
 ok(s.passed,'high-skilled player qualifies');
 for(const c of s.candidates)c.scores=Array.from({length:5},()=>c.cp);
 api.selectionRoster();ok(s.roster.length===7&&s.selected,'7 members');ok(s.roster.filter(c=>c.starter).length===5,'5 starters');
 for(let g=0;g<4;g++)ok(s.roster.filter(c=>c.starter&&c.group===g).length===1,'complete positions');
 const clubBefore=p.teamNpc(7),champ=JSON.stringify(p.champ),money=p.money,pop=p.pop;
 api.initTournament();ok(s.qMatches.length===35&&s.qMatches.every(m=>!m.done),'fixtures have no predetermined scores');
 ok(Object.keys(s.strengths).length===17&&s.strengths.JP>=75&&s.strengths.JP<=85,'17 nations + JP range');
 ok(s.qGroups.A.length===5&&s.qGroups.B.length===5&&s.qGroups.C.length===6&&!Object.values(s.qGroups).flat().includes('JP'),'qual groups');
 const strength=JSON.stringify(s.strengths),stamina=s.player.stamina;api.initTournament();ok(JSON.stringify(s.strengths)===strength&&s.player.stamina===stamina,'generation and recovery idempotent');
 for(let i=0;i<5;i++)api.playGroups(false);ok(s.qMatches.every(m=>m.done),'all 35 games played');ok(Object.values(s.qRanks).flatMap(rs=>rs.slice(0,3)).length===9,'nine qualify');
 const p2=E.Player.fromSave(JSON.parse(JSON.stringify(p.toJSON())));ok(JSON.stringify(p2.sports.qMatches)===JSON.stringify(s.qMatches),'save roundtrip');
 api.initMain();ok(s.mMatches.length===12&&Object.values(s.mGroups).flat().length===8,'eight main groups');ok(!Object.values(s.mGroups).flat().includes('JP')&&!Object.values(s.mGroups).flat().includes(s.best),'direct teams excluded');
 api.playGroups(true,true);api.initKO();ok(s.bracket[0].length===4&&s.bracket[0][0].a==='JP'&&s.bracket[0][2].a===s.best,'quarter bracket');
 s.eliminated=true;for(let r=0;r<3;r++)api.settleKO(r,true);ok(s.bracket.flat().length===7&&s.bracket.flat().every(m=>m.winner),'all knockout outcomes');
 ok(p.teamNpc(7)===clubBefore&&JSON.stringify(p.champ)===champ&&p.money===money&&p.pop===pop,'no league/club/reward pollution');
 const done=JSON.stringify(s.bracket);api.settleKO(2,true);ok(JSON.stringify(s.bracket)===done,'no reroll');
}
{
 const {p,s,api}=setup(9);for(const c of s.candidates)c.scores=Array(5).fill(c.cp);api.selectionRoster();s.node='camp';const pop=p.pop,club=p.teamNpc(7);const npc=s.roster.find(c=>c.id!=='player'),before=npc.tech,pt=p.tech;
 api.train(0);ok(p.tech===pt+4&&npc.tech===before+2,'player double / NPC base training');for(let i=0;i<5;i++)api.train(3);ok(s.training===5&&p.tac===100,'five sessions and caps');ok(p.teamNpc(7)===club,'club untouched');
 s.medal='金牌';s.result='冠军';api.award();api.award();ok(p.pop===pop+20,'award exactly once, no appearance multiplier');ok(p.totalChamp===0&&p.money===1000,'no league/financial reward');
 let ach=E.computeAchievements(p,true,true,null);ok(ach['金牌得主']&&!ach['银牌得主']&&!ach['铜牌得主'],'exclusive medal');p.pop=300;p.popular_count=3;ach=E.computeAchievements(p,true,true,null);ok(E.finalEnding(p,true,true,null,ach)==='传奇之上','legend priority');ok(E.finalEnding(p,true,true,'伤重退役',ach)==='伤重退役','forced ending priority');
}
{
 const {s}=setup(2,'求生者',10);ok(!s.passed&&!s.candidates.some(c=>c.id==='player'),'no guaranteed qualification');
 const p=new E.Player('青训','Old','Save','求生者');const old=E.Player.fromSave(JSON.parse(JSON.stringify(p.toJSON())));const a=A.ensure(old,5),copy=JSON.stringify(a);A.ensure(old,5);ok(JSON.stringify(a)===copy,'legacy save init once');
}
console.log(`Sports integration: ${checks} assertions passed across 80 tournament seeds.`);w.close();
