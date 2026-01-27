#!/usr/bin/env node

/**
 * Pre-publish check to ensure version is valid
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

console.log(`Publishing @skills-hot/shot v${packageJson.version}`);

// Ensure version is not 0.0.0 or similar placeholder
if (packageJson.version === '0.0.0') {
  console.error('Error: Version cannot be 0.0.0');
  process.exit(1);
}

console.log('Version check passed!');
