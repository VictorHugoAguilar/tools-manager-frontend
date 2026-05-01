#!/usr/bin/env node

/**
 * bump-version.js
 * Incrementa la versión en package.json según el tipo: major, minor o patch.
 *
 * Uso:
 *   node scripts/bump-version.js patch
 *   node scripts/bump-version.js minor
 *   node scripts/bump-version.js major
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const VALID_TYPES = ['major', 'minor', 'patch'];
const bumpType = process.argv[2];

if (!bumpType || !VALID_TYPES.includes(bumpType)) {
    console.error(`❌ Tipo de bump inválido: "${bumpType}"`);
    console.error(`   Uso: node scripts/bump-version.js [${VALID_TYPES.join(' | ')}]`);
    process.exit(1);
}

const packagePath = resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const currentVersion = pkg.version;

if (!currentVersion) {
    console.error('❌ El package.json no tiene el campo "version".');
    process.exit(1);
}

let [major, minor, patch] = currentVersion.split('.').map(Number);

if (bumpType === 'major') { major++; minor = 0; patch = 0; }
else if (bumpType === 'minor') { minor++; patch = 0; }
else if (bumpType === 'patch') { patch++; }

pkg.version = `${major}.${minor}.${patch}`;

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`✅ Versión actualizada: ${currentVersion} → ${pkg.version} (${bumpType})`);