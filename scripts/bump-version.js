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

const fs = require('fs');
const path = require('path');

// ─── Argumentos ───────────────────────────────────────────────────────────────

const VALID_TYPES = ['major', 'minor', 'patch'];
const bumpType = process.argv[2];

if (!bumpType || !VALID_TYPES.includes(bumpType)) {
    console.error(`❌ Tipo de bump inválido: "${bumpType}"`);
    console.error(`   Uso: node bump-version.js [${VALID_TYPES.join(' | ')}]`);
    process.exit(1);
}

// ─── Leer package.json ────────────────────────────────────────────────────────

const packagePath = path.resolve(process.cwd(), 'package.json');

if (!fs.existsSync(packagePath)) {
    console.error(`❌ No se encontró package.json en: ${packagePath}`);
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const currentVersion = pkg.version;

if (!currentVersion) {
    console.error('❌ El package.json no tiene el campo "version".');
    process.exit(1);
}

// ─── Calcular nueva versión ───────────────────────────────────────────────────

const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
const match = currentVersion.match(versionRegex);

if (!match) {
    console.error(`❌ El formato de versión no es semver válido: "${currentVersion}"`);
    process.exit(1);
}

let [, major, minor, patch] = match.map(Number);

switch (bumpType) {
    case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
    case 'minor':
        minor += 1;
        patch = 0;
        break;
    case 'patch':
        patch += 1;
        break;
}

const newVersion = `${major}.${minor}.${patch}`;

// ─── Escribir package.json ────────────────────────────────────────────────────

pkg.version = newVersion;

// Preserva el formato original (2 espacios de indentación)
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(`✅ Versión actualizada: ${currentVersion} → ${newVersion} (${bumpType})`);