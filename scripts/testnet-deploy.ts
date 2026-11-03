import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, encodeDeployData, formatEther, http, keccak256, parseEther, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { managerAbi } from '../packages/contracts/managerAbi';
import { mockWifAbi } from '../packages/contracts/mockWifAbi';

const source = process.argv[process.argv.indexOf('--key-file') + 1];
if (!process.argv.includes('--key-file') || !source) throw new Error('Use --key-file <local wallet file>');
const expected = process.argv[process.argv.indexOf('--address') + 1];
if (!process.argv.includes('--address') || !expected) throw new Error('Use --address <funded public account>');
const bytes = readFileSync(source);
const text = (bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '').trim();
const candidates = [...text.matchAll(/(?<![0-9a-f])(?:0x)?[0-9a-f]{64}(?![0-9a-f])/gi)].map(m => (m[0].startsWith('0x') ? m[0] : `0x${m[0]}`) as Hex);
const keys = candidates.filter(key => { try { return privateKeyToAccount(key).address.toLowerCase() === expected.toLowerCase(); } catch { return false; } });
if (keys.length !== 1) throw new Error('The wallet file must contain exactly one key matching the funded account');
const account = privateKeyToAccount(keys[0]);
const chain = defineChain({ id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } } });
const transport = http(chain.rpcUrls.default.http[0], { timeout: 20000, retryCount: 1 });
const client = createPublicClient({ chain, transport });
const wallet = createWalletClient({ account, chain, transport });
if (await client.getChainId() !== chain.id) throw new Error('Refusing a chain other than Robinhood testnet 46630');
const balance = await client.getBalance({ address: account.address });
if (balance === 0n) throw new Error('The supplied account has no testnet gas');
mkdirSync('.data', { recursive: true, mode: 0o700 });
const keyPath = '.data/testnet-wallet.json';
const credentials: { relayer: Hex; resultSigner: Hex } = existsSync(keyPath)
  ? JSON.parse(readFileSync(keyPath, 'utf8'))
  : { relayer: keys[0], resultSigner: `0x${randomBytes(32).toString('hex')}` };
if (credentials.relayer !== keys[0]) throw new Error('Existing Flat League testnet signer belongs to another account');
if (!existsSync(keyPath)) writeFileSync(keyPath, JSON.stringify(credentials), { flag: 'wx', mode: 0o600 });
const signer = privateKeyToAccount(credentials.resultSigner);
const attemptPath = '.data/testnet-deployment-attempts.json';
type Attempt = { hash: Hex; raw: Hex; codeHash: Hex; maximumFeeWei: string };
const attempts: Record<string, Attempt> = existsSync(attemptPath) ? JSON.parse(readFileSync(attemptPath, 'utf8')) : {};
const artifact = (name: string) => JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex } };
const tokenArtifact = artifact('MockWIF');
const managerArtifact = artifact('CompetitionManager');
const gasPrice = await client.getGasPrice();
const tokenData = encodeDeployData({ abi: mockWifAbi, bytecode: tokenArtifact.bytecode.object });
const tokenEstimate = await client.estimateGas({ account, data: tokenData });
console.log(JSON.stringify({ event: 'testnet_deployment_preflight', chainId: chain.id, deployer: account.address, resultSigner: signer.address, balanceETH: formatEther(balance), tokenMaximumFeeETH: formatEther(tokenEstimate * 12n / 10n * gasPrice), maximumFeePerDeploymentETH: '0.001', submitted: false }));
if (!process.argv.includes('--submit')) process.exit(0);

async function deploy(name: string, data: Hex) {
  let attempt = attempts[name];
  if (attempt && attempt.codeHash !== keccak256(data)) throw new Error('Existing deployment does not match this bytecode and constructor');
  if (!attempt) {
    const gas = (await client.estimateGas({ account, data })) * 12n / 10n;
    const price = await client.getGasPrice();
    const maximum = gas * price;
    if (maximum > parseEther('0.001') || maximum >= await client.getBalance({ address: account.address })) throw new Error('Deployment exceeds the 0.001 test ETH transaction budget or account balance');
    const request = await wallet.prepareTransactionRequest({ account, data, gas, gasPrice: price, type: 'legacy' });
    const raw = await wallet.signTransaction(request);
    attempt = { hash: keccak256(raw), raw, codeHash: keccak256(data), maximumFeeWei: maximum.toString() };
    attempts[name] = attempt;
    writeFileSync(attemptPath, JSON.stringify(attempts, null, 2), { mode: 0o600 });
  }
  const prior = await client.getTransactionReceipt({ hash: attempt.hash }).catch(error => { if (error.name === 'TransactionReceiptNotFoundError') return null; throw error; });
  if (!prior) await client.sendRawTransaction({ serializedTransaction: attempt.raw });
  const receipt = await client.waitForTransactionReceipt({ hash: attempt.hash, confirmations: 2, timeout: 120000 });
  if (receipt.status !== 'success' || !receipt.contractAddress || !await client.getCode({ address: receipt.contractAddress })) throw new Error('Testnet deployment did not produce a successful contract receipt');
  return { address: receipt.contractAddress, transactionHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash, gasFeeETH: formatEther(receipt.gasUsed * receipt.effectiveGasPrice) };
}
const token = await deploy('MockWIF', tokenData);
const manager = await deploy('CompetitionManager', encodeDeployData({ abi: managerAbi, bytecode: managerArtifact.bytecode.object, args: [token.address, signer.address, account.address] }));
const [observedToken, observedSigner, observedRegistrar, observedOwner] = await Promise.all([
  client.readContract({ address: manager.address, abi: managerAbi, functionName: 'wif' }),
  client.readContract({ address: manager.address, abi: managerAbi, functionName: 'defaultSigner' }),
  client.readContract({ address: manager.address, abi: managerAbi, functionName: 'defaultRegistrar' }),
  client.readContract({ address: manager.address, abi: managerAbi, functionName: 'owner' })
]);
if (observedToken.toLowerCase() !== token.address.toLowerCase() || observedSigner.toLowerCase() !== signer.address.toLowerCase() || observedRegistrar.toLowerCase() !== account.address.toLowerCase() || observedOwner.toLowerCase() !== account.address.toLowerCase()) throw new Error('Deployed authorities or token do not match the intended configuration');
const appUrl = 'https://flat-league.vercel.app';
const env = { NEXT_PUBLIC_APP_URL: appUrl, APP_URL: appUrl, NEXT_PUBLIC_CHAIN_ID: '46630', NEXT_PUBLIC_RPC_URL: chain.rpcUrls.default.http[0], RPC_URL: chain.rpcUrls.default.http[0],
  NEXT_PUBLIC_MANAGER_ADDRESS: manager.address, NEXT_PUBLIC_WIF_ADDRESS: token.address, RESULT_SIGNER_KEY: credentials.resultSigner, RELAYER_PRIVATE_KEY: credentials.relayer,
  CONFIRMATIONS: '2', DEPLOYMENT_BLOCK: manager.blockNumber, LOCAL_DEMO: 'false', FLAT_HOSTED_WORKER: 'true' };
writeFileSync('.data/testnet.env', Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
const report = { schema: 'flatleague.testnet-deployment.v1', checkedAt: new Date().toISOString(), chainId: chain.id, network: chain.name, rewardToken: 'MockWIF', testTokensOnly: true,
  deployer: account.address, resultSigner: signer.address, registrar: account.address, token, manager,
  remainingGasETH: formatEther(await client.getBalance({ address: account.address })), note: 'Genuine Robinhood Chain testnet deployments and verified authorities. MockWIF is a permissionless test token; these receipts do not establish real mainnet WIF use.' };
mkdirSync('evidence', { recursive: true });
writeFileSync('evidence/testnet-deployment.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ event: 'testnet_contracts_verified', ...report }, null, 2));
