import '../../src/server/load-env';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect as baseExpect, type Page } from '@playwright/test';
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { leagueChain, chainId, managerAddress, wifAddress } from '../../src/lib/config';
import { managerAbi } from '../../packages/contracts/managerAbi';
import { mockWifAbi } from '../../packages/contracts/mockWifAbi';
import { demoQuestions } from '../../packages/shared/demo-questions';
import { commitQuestions } from '../../packages/shared/domain';

const root=resolve('demo-video');
const expect=baseExpect.configure({timeout:30_000});
// Match the configured SIWE domain and same-origin mutation checks.
const base='http://localhost:3020';
assert.equal(chainId,31337,'Recording refuses non-local networks.');
assert.ok(managerAddress&&wifAddress);
const client=createPublicClient({chain:leagueChain,transport:http()});
assert.equal(await client.getChainId(),31337);
const creator=privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const playerKey=generatePrivateKey();
const player=privateKeyToAccount(playerKey);
const creatorWallet=createWalletClient({account:creator,chain:leagueChain,transport:http()});
const timeline=JSON.parse(readFileSync(root+'/timeline.json','utf8')) as {id:string;duration:number}[];
mkdirSync(root+'/assets/raw',{recursive:true});
mkdirSync(root+'/assets/runtime',{recursive:true});
// Local test credentials only, ignored and excluded from the portable kit.
writeFileSync(root+'/assets/runtime/player.json',JSON.stringify({chainId:31337,privateKey:playerKey}),{mode:0o600});
const errors:string[]=[];
const transactions:Hex[]=[];
const manifest:any={capturedAt:new Date().toISOString(),source:base,network:'Local Anvil ONLY',chainId:31337,token:'MockWIF',mainnetWifProof:false,viewport:{width:1440,height:616},segments:[],recorders:[],browserErrors:errors,answerResponses:[]};
const browser=await chromium.launch({headless:true,executablePath:'/home/greyw0rks/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const recorders:any[]=[];
async function recorder(account:typeof creator,name:string){
  const context=await browser.newContext({viewport:manifest.viewport,recordVideo:{dir:root+'/assets/raw',size:manifest.viewport},reducedMotion:'reduce'});
  const wallet=createWalletClient({account,chain:leagueChain,transport:http()});
  await context.exposeFunction('__leagueWalletRequest',async({method,params=[]}:{method:string;params?:unknown[]})=>{
    if(method==='eth_accounts'||method==='eth_requestAccounts')return[account.address];
    if(method==='eth_chainId')return'0x7a69';
    if(method==='wallet_switchEthereumChain'||method==='wallet_addEthereumChain')return null;
    if(method==='wallet_getCapabilities')return{};
    if(method==='personal_sign')return account.signMessage({message:{raw:params[0] as Hex}});
    if(method==='eth_sendTransaction'){
      const tx=params[0] as {to:Hex;data?:Hex;value?:Hex};
      const hash=await wallet.sendTransaction({to:tx.to,data:tx.data,value:tx.value?BigInt(tx.value):undefined});
      transactions.push(hash);return hash;
    }
    return client.request({method,params} as never);
  });
  await context.addInitScript(()=>{
    const bridge=window as unknown as {__leagueWalletRequest:(args:unknown)=>Promise<unknown>;ethereum:unknown};
    bridge.ethereum={isMetaMask:true,request:bridge.__leagueWalletRequest,on(){},removeListener(){}};
    document.addEventListener('DOMContentLoaded',()=>{
      const cursor=document.createElement('div');
      Object.assign(cursor.style,{position:'fixed',zIndex:'2147483647',width:'18px',height:'18px',border:'2px solid #6350d8',borderRadius:'50%',background:'#6350d822',pointerEvents:'none',transform:'translate(-50%,-50%)',display:'none'});
      document.body.append(cursor);
      document.addEventListener('mousemove',e=>{cursor.style.display='block';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';});
    });
  });
  context.on('page',page=>{
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',async response=>{
      if(response.url().includes('/api/')&&response.status()>=400){
        console.log('API response: '+response.request().method()+' '+new URL(response.url()).pathname+' HTTP '+response.status());
        console.log(await response.text().catch(()=>'(Response body unavailable after navigation.)'));
      }
    });
  });
  const page=await context.newPage();
  const data={name,context,page,started:Date.now()};
  recorders.push(data);return data;
}
async function go(page:Page,path:string){
  await page.goto(base+path,{waitUntil:'networkidle',timeout:90_000});
  await page.evaluate(()=>document.fonts.ready);
}
async function click(page:Page,control:ReturnType<Page['locator']>){
  await control.scrollIntoViewIfNeeded();
  const box=await control.boundingBox();
  if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});
  await control.click();
}
async function connect(page:Page){
  await click(page,page.getByRole('button',{name:'Connect wallet'}).first());
  await expect(page.getByRole('dialog')).toBeVisible({timeout:10_000});
  await click(page,page.getByRole('button',{name:'Browser wallet',exact:true}));
  await click(page,page.getByRole('button',{name:'Sign in to compete',exact:true}));
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function segment(data:any,id:string,action:()=>Promise<void>){
  const start=Date.now();
  await action();
  const duration=timeline.find(s=>s.id===id)!.duration;
  const remaining=duration*1000-(Date.now()-start);
  if(remaining>0)await data.page.waitForTimeout(remaining);
  const end=Date.now();
  await data.page.screenshot({path:root+'/assets/'+id+'-end.png'});
  manifest.segments.push({id,recorder:data.name,start:(start-data.started)/1000,end:(end-data.started)/1000,capturedSeconds:(end-start)/1000,duration,source:data.page.url()});
  writeFileSync(root+'/assets/capture-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  console.log('Captured '+id+' ('+((end-start)/1000).toFixed(1)+'s source).');
}
async function api(path:string){const response=await fetch(base+'/api'+path);assert.equal(response.status,200,path);return response.json();}
const dateInput=(ms:number)=>new Date(ms-new Date(ms).getTimezoneOffset()*60_000).toISOString().slice(0,16);
function workerTick(){
  if(process.env.CAPTURE_WORKER_MODE==='persistent')return;
  execFileSync(process.execPath,['--import','tsx',resolve('apps/worker/main.ts'),'--once'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
}
try{
  const health=await api('/health');assert.equal(health.ready,true);
  assert.deepEqual((await api('/competitions')).competitions,[],'Public demo cleanup must remain intact.');
  // Compile dynamic route bundles before creating a scheduled round. Loading a
  // route is read-only; no attempt starts until the player presses Start my run.
  const retained='a6e7b369-7f2d-46f7-b61b-970c61fe7321';
  for(const suffix of ['', '/play', '/results']){
    const response=await fetch(base+'/competitions/'+retained+suffix);
    assert.equal(response.status,200);await response.arrayBuffer();
  }
  const allowance=await client.readContract({address:wifAddress,abi:mockWifAbi,functionName:'allowance',args:[creator.address,managerAddress]});
  if(allowance!==0n){const reset=await creatorWallet.writeContract({address:wifAddress,abi:mockWifAbi,functionName:'approve',args:[managerAddress,0n]});await client.waitForTransactionReceipt({hash:reset});manifest.approvalReset=reset;}
  assert.equal(await client.getBalance({address:player.address}),0n);
  assert.equal(await client.readContract({address:wifAddress,abi:mockWifAbi,functionName:'balanceOf',args:[player.address]}),0n);
  const host=await recorder(creator,'creator');const page=host.page as Page;
  await go(page,'/');await expect(page.locator('.hero-art .game-world img')).toBeVisible();
  await page.locator('.game-hero').evaluate(el=>el.scrollIntoView({block:'start'}));
  await segment(host,'opening',async()=>{await page.mouse.move(250,440,{steps:15});});
  await go(page,'/discover');await page.locator('.lobby-feature-grid').scrollIntoViewIfNeeded();
  await segment(host,'discover',async()=>{await page.waitForTimeout(2500);await page.locator('#rounds').evaluate(el=>el.scrollIntoView({block:'center',behavior:'smooth'}));});
  await go(page,'/create');await connect(page);
  const title='Community Knowledge Run';
  await segment(host,'create',async()=>{
    const field=page.getByLabel('Challenge title');await click(page,field);await field.pressSequentially(title,{delay:55});
    await page.getByLabel('What is this challenge about?').fill('A recorded local walkthrough of creator funding, free entry, a timed run and confirmed MockWIF test rewards.');
    await page.waitForTimeout(1200);await click(page,page.getByRole('button',{name:'Continue',exact:true}));
    await click(page,page.getByRole('button',{name:/Use public sample questions/}));
    await page.waitForTimeout(2500);
    await page.getByRole('button',{name:'Continue',exact:true}).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);await click(page,page.getByRole('button',{name:'Continue',exact:true}));
  });
  const start=Math.ceil((Date.now()+40_000)/60_000)*60_000,end=start+300_000;
  let id='';
  await segment(host,'fund',async()=>{
    await page.getByLabel('Reward pool (MockWIF)').fill('10');
    await page.getByLabel('Starts · your local time').fill(dateInput(start));
    await page.getByLabel('Closes · your local time').fill(dateInput(end));
    await page.waitForTimeout(2200);await click(page,page.getByRole('button',{name:'Continue',exact:true}));
    await page.waitForTimeout(1800);await click(page,page.getByRole('button',{name:'Fund 10 MockWIF',exact:true}));
    await page.waitForURL(/\/competitions\/[\w-]+$/,{timeout:60_000});
    id=page.url().split('/').at(-1)!;
    // Mark through a short-lived SQLite connection. Do not run another Node
    // migration/client alongside the recording's app and worker connections.
    execFileSync('python3',['-c',"import sqlite3,sys; db=sqlite3.connect(sys.argv[1],timeout=30); assert db.execute('SELECT id FROM fl_competitions WHERE id=?',(sys.argv[2],)).fetchone(); db.execute('INSERT INTO fl_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING',('demo-round:'+sys.argv[2],'Local verification fixture')); db.commit(); db.close()",resolve(process.env.DATABASE_URL!.slice(5)),id]);
    await expect(page.getByText('Funding confirmed onchain')).toBeVisible();
    await page.locator('.reward-panel').scrollIntoViewIfNeeded();
  });
  const {competition:round}=await api('/competitions/'+id);
  assert.equal(round.pool,parseUnits('10',18).toString());
  assert.equal((await client.getTransactionReceipt({hash:round.fundingHash})).status,'success');
  assert.equal(transactions.length,2,'The browser must approve and fund exactly once.');
  manifest.competitionId=id;manifest.onchainId=round.onchainId;manifest.creator=creator.address;manifest.player=player.address;
  manifest.approvalHash=transactions[0];manifest.fundingHash=round.fundingHash;
  console.log('Actual local escrow funded. Waiting for the scheduled start.');
  const guest=await recorder(player,'player');const play=guest.page as Page;
  await go(play,'/competitions/'+id);
  while(Date.now()<start+1000)await play.waitForTimeout(Math.min(5000,start+1000-Date.now()));
  await segment(guest,'join',async()=>{
    await connect(play);
    await expect(play.getByRole('button',{name:'Join for free',exact:true})).toBeVisible({timeout:30_000});
    await click(play,play.getByRole('button',{name:'Join for free',exact:true}));
    await expect(play.getByText('Registering your place')).toBeVisible({timeout:10_000});
    for(let n=0;n<12;n++){
      workerTick();
      if(await client.readContract({address:managerAddress,abi:managerAbi,functionName:'participants',args:[BigInt(round.onchainId),player.address]}))break;
      await play.waitForTimeout(500);
    }
    await expect(play.getByRole('button',{name:'Start your run',exact:true})).toBeVisible({timeout:40_000});
    await play.waitForTimeout(1800);
    await click(play,play.getByRole('button',{name:'Start your run',exact:true}));
    await expect(play.getByRole('button',{name:'Start my run',exact:true})).toBeVisible();
    await guest.context.storageState({path:root+'/assets/runtime/player-session.json'});
    chmodSync(root+'/assets/runtime/player-session.json',0o600);
  });
  await segment(guest,'play',async()=>{
    await click(play,play.getByRole('button',{name:'Start my run',exact:true}));
    await play.waitForURL(/\/play$/);
    await expect(play.locator('fieldset.answers')).toBeVisible();
    for(let i=0;i<10;i++){
      const prompt=await play.locator('.quiz-container h1').innerText();
      const question=demoQuestions.find(q=>q.prompt===prompt)!;assert.ok(question);
      const text=question.options.find(o=>o.id===question.correctOption)!.text;
      await play.waitForTimeout(i<3?1300:600);
      await click(play,play.locator('.answer-option').filter({hasText:text}));
      if(i===0){await play.waitForTimeout(500);await play.reload({waitUntil:'networkidle'});await expect(play.locator('fieldset.answers')).toBeVisible();await expect(play.locator('.quiz-container h1')).toHaveText(prompt);await click(play,play.locator('.answer-option').filter({hasText:text}));}
      const started=Date.now();
      const responsePromise=play.waitForResponse(r=>r.url().endsWith('/answers')&&r.request().method()==='POST',{timeout:30_000});
      await click(play,play.getByRole('button',{name:i===9?'Finish my run':'Confirm & next',exact:true}));
      const response=await responsePromise;
      const body=await response.json();
      manifest.answerResponses.push({answer:i+1,status:response.status(),elapsedMs:Date.now()-started,accepted:body.accepted,error:body.error});
      console.log('Answer '+(i+1)+' confirmed in '+(Date.now()-started)+'ms (HTTP '+response.status()+').');
      assert.equal(response.status(),200,JSON.stringify(body));
      assert.equal(body.accepted,i+1);
      if(i<9)await expect(play.locator('.quiz-container h1')).not.toHaveText(prompt,{timeout:20_000});
    }
    await expect(play.getByRole('heading',{name:'Your run is in.'})).toBeVisible();
    assert.deepEqual((await api('/competitions/'+id+'/results')).standings,[]);
    await play.waitForTimeout(1500);
    await click(play,play.getByRole('link',{name:'View standings',exact:true}));
  });
  console.log('The genuine timed run is complete; live scores are hidden. Waiting for actual closing and payout.');
  while(Date.now()<end+1000)await play.waitForTimeout(Math.min(10_000,end+1000-Date.now()));
  let result:any;
  for(let n=0;n<40;n++){workerTick();result=await api('/competitions/'+id+'/results');if(result.finalized&&result.standings[0]?.paid)break;await play.waitForTimeout(1000);}
  assert.ok(result.finalized&&result.standings[0]?.paid,'The payout must confirm before filming it.');
  const winner=result.standings[0];assert.equal(winner.wallet.toLowerCase(),player.address.toLowerCase());assert.equal(winner.score,100);
  assert.equal(await client.readContract({address:wifAddress,abi:mockWifAbi,functionName:'balanceOf',args:[player.address]}),parseUnits('10',18));
  assert.equal(commitQuestions(result.artifact.questions,result.artifact.salt),round.questionCommitment);
  assert.equal((await client.getTransactionReceipt({hash:winner.txHash})).status,'success');
  manifest.settlementHash=result.settlementHash;manifest.rewardHash=winner.txHash;manifest.score=winner.score;manifest.elapsedMs=winner.elapsedMs;manifest.rewardAtomic=winner.reward;
  await play.reload();await expect(play.getByText('Your reward has arrived.')).toBeVisible({timeout:30_000});
  await segment(guest,'results',async()=>{
    await play.locator('.results-podium').scrollIntoViewIfNeeded();
    await play.waitForTimeout(7000);
    await play.locator('.result-next').last().evaluate(el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
  });
  await go(page,'/');await page.locator('.landing-cta').scrollIntoViewIfNeeded();
  await segment(host,'closing',async()=>{await page.mouse.move(1180,340,{steps:20});});
  assert.deepEqual((await api('/competitions')).competitions,[]);
  assert.deepEqual((await api('/leaderboard')).players,[]);
  assert.deepEqual(errors,[]);
  manifest.publicRoundsAfterRecording=0;manifest.status='passed';
  manifest.workerMode=process.env.CAPTURE_WORKER_MODE==='persistent'?'Existing persistent worker, independent app/worker processes':'Existing worker --once, fresh process per tick';
  console.log('PASS: real local funding → free join → timed quiz → signed settlement → confirmed 10 MockWIF payout.');
}catch(error){
  manifest.status='failed';manifest.error=error instanceof Error?error.message:'Capture failed';
  for(const data of recorders)await data.page.screenshot({path:root+'/assets/failure-'+data.name+'.png'}).catch(()=>{});
  throw error;
}finally{
  for(const data of recorders){
    const video=data.page.video();
    const capturedSeconds=(Date.now()-data.started)/1000;
    await data.context.close();
    const file=root+'/assets/raw/'+data.name+'.webm';await video.saveAs(file);
    manifest.recorders.push({name:data.name,file:'raw/'+data.name+'.webm',capturedSeconds});
  }
  writeFileSync(root+'/assets/capture-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  await browser.close();
}
