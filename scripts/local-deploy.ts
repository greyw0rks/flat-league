import { createPublicClient, createWalletClient, http, defineChain, parseUnits, getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { managerAbi } from '../packages/contracts/managerAbi';
import { mockWifAbi } from '../packages/contracts/mockWifAbi';

// Anvil's published test accounts. This script refuses any network other than local chain 31337.
const creatorKey='0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;
const registrarKey='0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex;
const signerKey='0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex;
const chain=defineChain({id:31337,name:'Flat League Local',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['http://127.0.0.1:8547']}}});
const creator=privateKeyToAccount(creatorKey),registrar=privateKeyToAccount(registrarKey),signer=privateKeyToAccount(signerKey);
const client=createPublicClient({chain,transport:http()});
if(await client.getChainId()!==31337)throw new Error('Local deployment requires Anvil chain 31337.');
if(existsSync('evidence/local-deployment.json')){
  const prior=JSON.parse(readFileSync('evidence/local-deployment.json','utf8'));
  if(await client.getCode({address:prior.manager})){
    console.log('Existing local deployment is active. See evidence/local-deployment.json.');
    process.exit(0);
  }
  if (!process.argv.includes('--fresh')) throw new Error('The local chain was reset. Run pnpm local:deploy --fresh to archive the old local playground and deploy again.');
  const archive = `.data/archive/${Date.now()}`;
  mkdirSync(archive, { recursive: true });
  for (const path of ['.env.local', '.data/flat-league.db', '.data/flat-league.db-wal', '.data/flat-league.db-shm', 'evidence/local-deployment.json'])
    if (existsSync(path)) renameSync(path, `${archive}/${path.split('/').at(-1)}`);
  console.log(`Archived the previous local playground in ${archive}.`);
}
const wallet=createWalletClient({account:creator,chain,transport:http()});
const bytecode=(name:string)=>JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8')).bytecode.object as Hex;
const tokenHash=await wallet.deployContract({abi:mockWifAbi,bytecode:bytecode('MockWIF')});
const tokenReceipt=await client.waitForTransactionReceipt({hash:tokenHash});
const token=tokenReceipt.contractAddress!;
const managerHash=await wallet.deployContract({abi:managerAbi,bytecode:bytecode('CompetitionManager'),args:[token,signer.address,registrar.address]});
const managerReceipt=await client.waitForTransactionReceipt({hash:managerHash});const manager=managerReceipt.contractAddress!;
for(const account of [creator,registrar,signer]){
  const hash=await wallet.writeContract({address:token,abi:mockWifAbi,functionName:'mint',args:[account.address,parseUnits('10000',18)]});await client.waitForTransactionReceipt({hash});
}
const env={NEXT_PUBLIC_APP_URL:'http://localhost:3020',APP_URL:'http://localhost:3020',NEXT_PUBLIC_CHAIN_ID:'31337',NEXT_PUBLIC_RPC_URL:'http://127.0.0.1:8547',RPC_URL:'http://127.0.0.1:8547',NEXT_PUBLIC_MANAGER_ADDRESS:manager,NEXT_PUBLIC_WIF_ADDRESS:token,DATABASE_URL:'file:.data/flat-league.db',RESULT_SIGNER_KEY:signerKey,RELAYER_PRIVATE_KEY:registrarKey,CONFIRMATIONS:'1',DEPLOYMENT_BLOCK:managerReceipt.blockNumber.toString(),LOCAL_DEMO:'true'};
writeFileSync('.env.local','# LOCAL ANVIL ONLY. Public test keys; never use these accounts on a real network.\n'+Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
for(const[k,v]of Object.entries(env))process.env[k]=v;
const {createDraft,publishDraft,markDemoCompetition}=await import('../src/server/league');
const {demoQuestions}=await import('../packages/shared/demo-questions');
const now=Date.now();const earliest=Math.floor(now/1000)*1000+30_000;
const rounds=[];
const approvalHash=await wallet.writeContract({address:token,abi:mockWifAbi,functionName:'approve',args:[manager,parseUnits('1000',18)]});await client.waitForTransactionReceipt({hash:approvalHash});
for(const [index,title,pool,offset]of [[0,'The Knowledge Run','250',0],[1,'Community Sprint','180',3600_000],[2,'The Curious League','100',0]] as const){
  const draft=await createDraft(creator.address,{title,description:'A public sample round in the local MockWIF playground. Ten questions, two minutes, and a place on the podium.',pool,startAt:earliest+offset,endAt:earliest+offset+6*3600_000,maxParticipants:100,questions:demoQuestions});
  const cfg=draft.config;
  const hash=await wallet.writeContract({address:manager,abi:managerAbi,functionName:'createCompetition',args:[{...cfg,startAt:BigInt(cfg.startAt),endAt:BigInt(cfg.endAt),finalizeBy:BigInt(cfg.finalizeBy)},BigInt(draft.pool)]});await client.waitForTransactionReceipt({hash});
  const published=await publishDraft(creator.address,draft.id,hash);await markDemoCompetition(published.id);rounds.push({id:published.id,title,fundingHash:hash,startAt:earliest+offset});
}
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/local-deployment.json',JSON.stringify({network:'Local Anvil ONLY',chainId:31337,token,manager,creator:creator.address,registrar:registrar.address,signer:signer.address,tokenDeployment:tokenHash,managerDeployment:managerHash,approvalHash,rounds},null,2)+'\n');
console.log(`Local contracts deployed. ${rounds.length} real MockWIF-funded rounds created. Start web and worker with pnpm dev and pnpm worker.`);
