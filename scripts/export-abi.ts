import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('packages/contracts', { recursive: true });
for (const [name, variable] of [['CompetitionManager', 'managerAbi'], ['MockWIF', 'mockWifAbi']]) {
  const artifact = JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, 'utf8'));
  writeFileSync(`packages/contracts/${variable}.ts`, `// Generated from Foundry. Run pnpm exec tsx scripts/export-abi.ts after contract changes.\nexport const ${variable} = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
}
