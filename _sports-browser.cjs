const {chromium}=require('playwright');const {pathToFileURL}=require('url');const path=require('path');const fs=require('fs');const assert=require('assert/strict');
const url=pathToFileURL(path.join(__dirname,'index.html')).href;
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{window.__KO_FAST=true;});
 await page.goto(url);assert((await page.title()).includes('7.0'));
 async function seed(phase,role='求生者',seed=41){
  await page.evaluate(({phase,role,seed})=>{
   const E=window.IVL,p=new E.Player('青训','BrowserClub','Tester',role);p.position=role==='监管者'?'zj':'qz';for(const k of ['tech','tac','phys','stab'])p[k]=95;p.stamina=p.stamina_max;p.money=10000;p.pop=275;p.popular_count=3;p._grandSlam=true;p._yearsCompleted=6;p.cur_year=7;
   const teams=E.generateTeams(p.teamName);teams.meta=E.buildTeamMeta(teams);window.IVLSports.ensure(p,7);Object.assign(p.sports,{enabled:true,noticeYear:7,seed,status:'scheduled',group:role==='监管者'?4:1});
   if(phase==='sportsTournament'){const api=window.IVLSports.createSession({player:p,teams,year:7,save(){}});api.pull();api.makeCandidates();for(const c of p.sports.candidates)c.scores=Array(5).fill(c.cp);api.selectionRoster();api.complete();p.sports.status='selected';p.sports.node='waitingAbyss';}
   p._careerCheckpoint={year:7,step:phase,yc:['夏','秋','IVS','深渊'],summerRank:1,autumnRank:1,snap:{tech:95,tac:95,phys:95,stab:95,pop:p.pop,money:p.money,appearance:p.appearance,teamNpc:p.teamNpc(7)}};
   localStorage.setItem('ivl_run_v1',JSON.stringify({v:1,curYear:7,curAge:24,player:p.toJSON(),gameTeams:teams,logLines:[],meta:{name:p.name,year:7}}));
  },{phase,role,seed});await resume();
 }
 async function resume(){await page.reload();await page.locator('#splashStart').click();await page.getByRole('button',{name:/继续生涯（第/}).click();await page.waitForTimeout(40);}
 async function click(action){const x=page.locator(`[data-action="${action}"]`).filter({visible:true}).first();await x.click();}
 async function snapshot(){return page.evaluate(()=>JSON.parse(localStorage.getItem('ivl_run_v1')).player.sports);}
 await seed('sportsSelection');await click('signup');await click('chooseGroup:1');await click('go:candidates');await click('startTrials');await click('trialRoll');
 let before=await snapshot();assert.equal(before.round,1);await resume();let after=await snapshot();assert.deepEqual(after.candidates,before.candidates);assert.equal(after.round,1);
 for(let i=0;i<4;i++){await click('nextTrial');await click('trialRoll');}await click('nextTrial');assert.equal((await snapshot()).roster.length,7);
 await page.screenshot({path:'/tmp/ivl70-selection.png',fullPage:true});await click('go:preAbyss');await page.waitForTimeout(100);
 assert.equal((await snapshot()).status,'selected');assert.equal(await page.evaluate(()=>P._careerCheckpoint.step),'abyssTrain');
 console.log('PASS real selection -> resume -> five rounds -> real abyss training');
 await seed('sportsTournament');await click('go:qualMatches');for(let i=0;i<5;i++)await click('playQual');await click('finishQual');await click('go:camp');await click('train:0');before=await snapshot();await resume();after=await snapshot();assert.equal(after.training,1);assert.equal(after.player.tech,before.player.tech);await click('closeTraining');
 for(let i=0;i<4;i++){await click('train:3');await click('closeTraining');}await click('enterMain');
 after=await snapshot();for(let i=0;i<(after.best==='CHN'?1:3);i++)await click('playMain');await click('finishMain');
 await page.waitForTimeout(100);await page.screenshot({path:'/tmp/ivl70-bracket.png',fullPage:true});
 for(let r=0;r<2;r++){
  await click('go:knockout');await click('rollKO');if(r===0){before=await snapshot();await resume();after=await snapshot();assert.equal(after.koRoll,before.koRoll);}
  await click('playKO');await click('nextKO');
 }
 await click('startFinal');let gfClicks=0,refreshed=false;
 for(let i=0;i<600;i++){
  if(!await page.locator('#gfOverlay').count())break;
  const act=page.locator('#gf-act');if(await act.isEnabled()){
   await act.click();gfClicks++;
   if(gfClicks===4&&!refreshed){before=await snapshot();await resume();after=await snapshot();assert.equal(after.finalClicks,before.finalClicks);await click('startFinal');refreshed=true;}
  }await page.waitForTimeout(10);
 }
 assert(!await page.locator('#gfOverlay').count(),'final completes');await click('nextKO');await page.screenshot({path:'/tmp/ivl70-medal.png',fullPage:true});await click('award');
 before=await snapshot();assert(before.awarded);const pop=before.player.pop;await resume();after=await snapshot();assert.equal(after.player.pop,pop);assert.equal(after.awarded,true);
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:'/tmp/ivl70-mobile.png',fullPage:true});
 const width=await page.evaluate(()=>({body:document.body.scrollWidth,view:innerWidth}));assert(width.body<=width.view+1,JSON.stringify(width));
 await click('returnCareer');await page.waitForTimeout(80);assert(!(await page.locator('body').getAttribute('class')||'').includes('sports-active'));
 console.log(`PASS qualifier/camp/knockout/final dice (${gfClicks} clicks), resume at camp/roll/final/award, mobile layout, return to career`);
 // No sport preview or hardcoded demo controls are reachable in the integrated page.
 assert(!await page.getByRole('button',{name:'演示预览',exact:true}).count());assert.deepEqual(errors,[]);
 // Real exit paths: no route/outcome overrides exist in the game.
 await page.setViewportSize({width:1366,height:900});
 await seed('sportsSelection','监管者',52);await click('decline');assert.equal((await snapshot()).result,'拒绝报名');await click('returnCareer');
 assert.equal(await page.evaluate(()=>P._careerCheckpoint.step),'abyssTrain');
 await seed('sportsSelection','监管者',53);
 await page.evaluate(()=>{for(const k of ['tech','tac','phys','stab'])P[k]=10;window.IVLSports.active.pull();window.IVLSports.active.save();});
 await click('signup');assert.equal((await snapshot()).passed,false);await click('failedQualification');await click('go:finish');await click('returnCareer');
 assert.equal(await page.evaluate(()=>P._careerCheckpoint.step),'abyssTrain');
 await seed('sportsTournament','监管者',54);
 await page.evaluate(()=>{for(const k of ['tech','tac','phys','stab'])P[k]=10;window.IVLSports.active.pull();window.IVLSports.active.save();});
 await click('go:qualMatches');for(let i=0;i<5;i++)await click('playQual');await click('finishQual');
 after=await snapshot();assert.equal(after.result,'预选赛出局');assert.equal(after.training,0);assert(after.champion);assert(after.bracket.flat().every(m=>m.done));
 await click('go:finish');await click('returnCareer');
 console.log('PASS decline, hunter qualification failure, qualifier elimination and automatic remainder');
 assert.deepEqual(errors,[]);
 console.log('Browser integration PASS; screenshots /tmp/ivl70-*.png');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
