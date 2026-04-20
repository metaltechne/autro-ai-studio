import * as fs from 'fs';

const content = fs.readFileSync('./data/initial-inventory.ts', 'utf-8');

const compSkus = new Set<string>();
const kitSkus = new Set<string>();

const compRegex = /sku:\s*'([^']+)'/g;
let match;
while ((match = compRegex.exec(content)) !== null) {
  compSkus.add(match[1]);
}

const kitRegex = /componentSku:\s*'([^']+)'/g;
while ((match = kitRegex.exec(content)) !== null) {
  kitSkus.add(match[1]);
}

const missing: string[] = [];
for (const sku of Array.from(kitSkus)) {
  if (!compSkus.has(sku)) {
    missing.push(sku);
  }
}

console.log("Missing SKUs:", missing);
