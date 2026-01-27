#!/usr/bin/env node

/**
 * Skills Hot CLI wrapper
 * Downloads and runs the native skb binary
 */

import { existsSync } from 'node:fs';
import { mkdir, chmod, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '.cache');
const GITHUB_REPO = 'yan-labs/skills-hot';

/**
 * Detect platform and architecture
 */
function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  let os;
  switch (platform) {
    case 'darwin':
      os = 'darwin';
      break;
    case 'linux':
      os = 'linux';
      break;
    case 'win32':
      os = 'windows';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archName;
  switch (arch) {
    case 'x64':
      archName = 'x64';
      break;
    case 'arm64':
      archName = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return `${os}-${archName}`;
}

/**
 * Get binary name based on platform
 */
function getBinaryName() {
  return process.platform === 'win32' ? 'shot.exe' : 'shot';
}

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'skills-hot-cli' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'skills-hot-cli' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Get latest version from GitHub
 * Falls back to hardcoded version if API is rate-limited
 */
const FALLBACK_VERSION = 'v0.1.0';

async function getLatestVersion() {
  try {
    const release = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    return release.tag_name;
  } catch (err) {
    // No releases yet
    if (err.message === 'HTTP 404') {
      throw new Error(
        'No releases found. The Skills Hot CLI binary has not been published yet.\n' +
        'Please check https://github.com/yan-labs/skills-hot/releases for updates.'
      );
    }
    // Rate limited or other API error - use fallback
    if (err.message === 'HTTP 403' || err.message === 'HTTP 429') {
      console.log(`GitHub API rate limited, using fallback version ${FALLBACK_VERSION}`);
      return FALLBACK_VERSION;
    }
    throw err;
  }
}

/**
 * Download and extract binary
 */
async function downloadBinary(version, platform) {
  const binaryName = getBinaryName();
  const versionDir = join(CACHE_DIR, version);
  const binaryPath = join(versionDir, binaryName);
  // The binary in tarball is named skb-{platform}
  const extractedBinaryName = `shot-${platform}`;
  const extractedBinaryPath = join(versionDir, extractedBinaryName);

  // Check if already downloaded
  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  console.log(`Downloading Skills Hot CLI ${version} for ${platform}...`);

  // Create cache directory
  await mkdir(versionDir, { recursive: true });

  // Download tarball
  const tarballUrl = `https://github.com/${GITHUB_REPO}/releases/download/${version}/shot-${platform}.tar.gz`;
  const tarballPath = join(versionDir, 'shot.tar.gz');

  try {
    await downloadFile(tarballUrl, tarballPath);
  } catch (err) {
    if (err.message === 'HTTP 404') {
      throw new Error(
        `Binary not found for ${platform}.\n` +
        `This could mean:\n` +
        `  1. The version ${version} doesn't exist\n` +
        `  2. Your platform (${platform}) is not supported\n` +
        `\nCheck https://github.com/${GITHUB_REPO}/releases for available downloads.`
      );
    }
    throw new Error(`Failed to download binary: ${err.message}\nURL: ${tarballUrl}`);
  }

  // Extract tarball
  await extract({
    file: tarballPath,
    cwd: versionDir,
  });

  // Clean up tarball
  await rm(tarballPath, { force: true });

  // Rename extracted binary to standard name
  const { rename } = await import('node:fs/promises');
  await rename(extractedBinaryPath, binaryPath);

  // Make binary executable
  if (process.platform !== 'win32') {
    await chmod(binaryPath, 0o755);
  }

  console.log('Download complete!\n');
  return binaryPath;
}

/**
 * Run the binary with arguments
 */
function runBinary(binaryPath, args) {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to run shot: ${err.message}`);
      resolve(1);
    });
  });
}

/**
 * Main entry point
 */
async function main() {
  try {
    const platform = getPlatform();
    const version = await getLatestVersion();
    const binaryPath = await downloadBinary(version, platform);
    const exitCode = await runBinary(binaryPath, process.argv.slice(2));
    process.exit(exitCode);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
