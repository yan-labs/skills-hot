/**
 * Git Object Packing Utilities
 * Generates valid Git objects for Dumb HTTP protocol
 *
 * Git Object Types:
 * - blob: file content
 * - tree: directory listing
 * - commit: snapshot with metadata
 *
 * All objects are stored as: header + content, then zlib compressed
 * Header format: "{type} {size}\0"
 */

import * as pako from 'pako';

/**
 * Git object representation
 */
export interface GitObject {
  sha: string;
  type: 'blob' | 'tree' | 'commit';
  data: Uint8Array; // zlib compressed
}

/**
 * File entry for tree object
 */
export interface TreeEntry {
  mode: string; // '100644' for regular file, '100755' for executable, '40000' for directory
  name: string;
  sha: string;
}

/**
 * Complete Git pack for serving via HTTP
 */
export interface GitPack {
  objects: Map<string, GitObject>;
  refs: { [name: string]: string };
  headCommit: string;
}

/**
 * Calculate SHA-1 hash of data
 */
async function sha1(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concatArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Create a blob object from file content
 */
async function createBlob(
  content: string,
  objects: Map<string, GitObject>
): Promise<string> {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);

  // Create raw object: "blob {size}\0{content}"
  const header = encoder.encode(`blob ${contentBytes.length}\0`);
  const rawObject = concatArrays(header, contentBytes);

  const sha = await sha1(rawObject);

  // Store compressed object
  objects.set(sha, {
    sha,
    type: 'blob',
    data: pako.deflate(rawObject),
  });

  return sha;
}

/**
 * Create a tree object from entries
 */
async function createTree(
  entries: TreeEntry[],
  objects: Map<string, GitObject>
): Promise<string> {
  const encoder = new TextEncoder();

  // Sort entries by name (Git requirement)
  entries.sort((a, b) => a.name.localeCompare(b.name));

  // Build tree content: "{mode} {name}\0{sha_bytes}" for each entry
  const entryBuffers: Uint8Array[] = [];

  for (const entry of entries) {
    const modeAndName = encoder.encode(`${entry.mode} ${entry.name}\0`);
    const shaBytes = hexToBytes(entry.sha);
    entryBuffers.push(concatArrays(modeAndName, shaBytes));
  }

  const treeContent = concatArrays(...entryBuffers);

  // Create raw object: "tree {size}\0{content}"
  const header = encoder.encode(`tree ${treeContent.length}\0`);
  const rawObject = concatArrays(header, treeContent);

  const sha = await sha1(rawObject);

  objects.set(sha, {
    sha,
    type: 'tree',
    data: pako.deflate(rawObject),
  });

  return sha;
}

/**
 * Create a commit object
 */
async function createCommit(
  treeSha: string,
  message: string,
  objects: Map<string, GitObject>,
  timestamp?: number
): Promise<string> {
  const encoder = new TextEncoder();
  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Build commit content
  const commitLines = [
    `tree ${treeSha}`,
    `author SkillBank <noreply@skillbank.dev> ${ts} +0000`,
    `committer SkillBank <noreply@skillbank.dev> ${ts} +0000`,
    '',
    message,
  ];
  const commitContent = encoder.encode(commitLines.join('\n'));

  // Create raw object: "commit {size}\0{content}"
  const header = encoder.encode(`commit ${commitContent.length}\0`);
  const rawObject = concatArrays(header, commitContent);

  const sha = await sha1(rawObject);

  objects.set(sha, {
    sha,
    type: 'commit',
    data: pako.deflate(rawObject),
  });

  return sha;
}

/**
 * Create a complete Git pack for a skill
 *
 * @param skillSlug - Skill slug for commit message
 * @param content - SKILL.md content
 * @param additionalFiles - Optional additional files (path -> content)
 */
export async function createGitPack(
  skillSlug: string,
  content: string,
  additionalFiles?: Map<string, string>
): Promise<GitPack> {
  const objects = new Map<string, GitObject>();
  const treeEntries: TreeEntry[] = [];

  // Create blob for SKILL.md
  const skillBlobSha = await createBlob(content, objects);
  treeEntries.push({
    mode: '100644',
    name: 'SKILL.md',
    sha: skillBlobSha,
  });

  // Create blobs for additional files
  if (additionalFiles) {
    for (const [path, fileContent] of additionalFiles) {
      const blobSha = await createBlob(fileContent, objects);
      treeEntries.push({
        mode: '100644',
        name: path,
        sha: blobSha,
      });
    }
  }

  // Create tree
  const treeSha = await createTree(treeEntries, objects);

  // Create commit
  const commitSha = await createCommit(treeSha, `Skill: ${skillSlug}`, objects);

  return {
    objects,
    refs: {
      'refs/heads/main': commitSha,
      HEAD: commitSha,
    },
    headCommit: commitSha,
  };
}

/**
 * Generate /info/refs response for dumb HTTP protocol
 */
export function generateInfoRefs(pack: GitPack): string {
  let refs = '';
  for (const [name, sha] of Object.entries(pack.refs)) {
    if (name !== 'HEAD') {
      refs += `${sha}\t${name}\n`;
    }
  }
  return refs;
}

/**
 * Generate /info/refs response for smart HTTP protocol (git-upload-pack)
 * Format: pkt-line format with capabilities
 */
export function generateSmartInfoRefs(pack: GitPack): Uint8Array {
  const encoder = new TextEncoder();
  const lines: Uint8Array[] = [];

  // Capabilities we support (multi_ack_detailed required for stateless-rpc)
  const capabilities = [
    'multi_ack_detailed',
    'thin-pack',
    'side-band',
    'side-band-64k',
    'ofs-delta',
    'shallow',
    'deepen-since',
    'deepen-not',
    'deepen-relative',
    'no-progress',
    'include-tag',
    'allow-tip-sha1-in-want',
    'allow-reachable-sha1-in-want',
    'no-done',
    'symref=HEAD:refs/heads/main',
    'filter',
    'object-format=sha1',
  ].join(' ');

  // First line: HEAD with capabilities
  const headSha = pack.refs['refs/heads/main'];
  const firstLine = `${headSha} HEAD\0${capabilities}\n`;
  lines.push(pktLine(firstLine));

  // Additional refs
  for (const [name, sha] of Object.entries(pack.refs)) {
    if (name !== 'HEAD') {
      lines.push(pktLine(`${sha} ${name}\n`));
    }
  }

  // symref for HEAD
  lines.push(pktLine(`${headSha} HEAD\n`));

  // Flush packet
  lines.push(encoder.encode('0000'));

  return concatArrays(...lines);
}

/**
 * Create a pkt-line formatted string
 * Format: 4-digit hex length prefix + content
 */
function pktLine(content: string): Uint8Array {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const length = contentBytes.length + 4;
  const lengthHex = length.toString(16).padStart(4, '0');
  return concatArrays(encoder.encode(lengthHex), contentBytes);
}

/**
 * Parse git-upload-pack request body
 * Returns list of wanted SHAs and shallow depth
 */
export function parseUploadPackRequest(body: Uint8Array): {
  wants: string[];
  haves: string[];
  depth: number | null;
  done: boolean;
} {
  const decoder = new TextDecoder();
  const text = decoder.decode(body);

  const wants: string[] = [];
  const haves: string[] = [];
  let depth: number | null = null;
  let done = false;

  // Parse pkt-lines
  let offset = 0;
  while (offset < text.length) {
    // Read 4-byte length
    const lengthHex = text.substring(offset, offset + 4);

    if (lengthHex === '0000') {
      // Flush packet
      offset += 4;
      continue;
    }

    if (lengthHex === '0009' && text.substring(offset + 4, offset + 8) === 'done') {
      done = true;
      offset += 9;
      continue;
    }

    const length = parseInt(lengthHex, 16);
    if (isNaN(length) || length < 4) {
      break;
    }

    const line = text.substring(offset + 4, offset + length).trim();
    offset += length;

    if (line.startsWith('want ')) {
      const sha = line.substring(5, 45);
      wants.push(sha);
    } else if (line.startsWith('have ')) {
      const sha = line.substring(5, 45);
      haves.push(sha);
    } else if (line.startsWith('deepen ')) {
      depth = parseInt(line.substring(7), 10);
    } else if (line === 'done') {
      done = true;
    }
  }

  return { wants, haves, depth, done };
}

/**
 * Generate a packfile containing all objects
 * Format: PACK header + entries + SHA-1 checksum
 */
export async function generatePackfile(pack: GitPack): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const objects = Array.from(pack.objects.values());

  // PACK header: "PACK" + version(4 bytes) + object count(4 bytes)
  const header = new Uint8Array(12);
  header.set(encoder.encode('PACK'), 0);
  // Version 2
  header[4] = 0; header[5] = 0; header[6] = 0; header[7] = 2;
  // Object count (big-endian)
  const count = objects.length;
  header[8] = (count >> 24) & 0xff;
  header[9] = (count >> 16) & 0xff;
  header[10] = (count >> 8) & 0xff;
  header[11] = count & 0xff;

  // Pack entries
  const entries: Uint8Array[] = [header];

  for (const obj of objects) {
    // Decompress to get raw object
    const rawObject = pako.inflate(obj.data);

    // Parse to get just the content (after null byte)
    const nullIndex = rawObject.indexOf(0);
    const content = rawObject.slice(nullIndex + 1);

    // Type byte encoding
    const typeNum = obj.type === 'commit' ? 1 : obj.type === 'tree' ? 2 : 3;

    // Size encoding (variable length)
    const sizeBytes = encodePackSize(typeNum, content.length);

    // Compress content
    const compressed = pako.deflate(content);

    entries.push(sizeBytes);
    entries.push(compressed);
  }

  // Combine all parts
  const packData = concatArrays(...entries);

  // Calculate SHA-1 checksum of pack data (excluding the checksum itself)
  const checksum = await sha1Raw(packData);

  return concatArrays(packData, checksum);
}

/**
 * Encode pack entry size with type
 * First byte: 1tttssss (type 3 bits, size 4 bits, MSB = more bytes follow)
 * Subsequent bytes: 1sssssss (7 bits of size each)
 */
function encodePackSize(type: number, size: number): Uint8Array {
  const bytes: number[] = [];

  // First byte: type in bits 4-6, low 4 bits of size
  let byte = (type << 4) | (size & 0x0f);
  size >>= 4;

  if (size > 0) {
    byte |= 0x80; // MSB = more bytes follow
  }
  bytes.push(byte);

  // Subsequent bytes: 7 bits of size each
  while (size > 0) {
    byte = size & 0x7f;
    size >>= 7;
    if (size > 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  }

  return new Uint8Array(bytes);
}

/**
 * Calculate SHA-1 hash and return as bytes
 */
async function sha1Raw(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Generate git-upload-pack response with packfile
 * Uses side-band-64k for progress and data
 *
 * @param pack - Git pack to send
 * @param isShallow - Whether this is a shallow clone request
 */
export async function generateUploadPackResponse(
  pack: GitPack,
  isShallow: boolean = false,
  isDonePhase: boolean = false
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const lines: Uint8Array[] = [];

  // For shallow clones, always send shallow line
  // In stateless-rpc mode, each request is independent, so we need to re-send shallow status
  if (isShallow) {
    lines.push(pktLine(`shallow ${pack.headCommit}\n`));
  }

  // Flush packet after shallow list (only in shallow mode)
  if (isShallow) {
    lines.push(encoder.encode('0000'));
  }

  // NAK line (we have no common base with client)
  lines.push(pktLine('NAK\n'));

  // Generate packfile
  const packfile = await generatePackfile(pack);

  // Send packfile in side-band-64k format
  // Band 1 = pack data, Band 2 = progress, Band 3 = error
  const CHUNK_SIZE = 65515; // 65519 - 4 (pkt-line header)

  for (let offset = 0; offset < packfile.length; offset += CHUNK_SIZE) {
    const chunk = packfile.slice(offset, Math.min(offset + CHUNK_SIZE, packfile.length));

    // Side-band format: length(4) + band(1) + data
    const bandedChunk = new Uint8Array(chunk.length + 1);
    bandedChunk[0] = 0x01; // Band 1 = pack data
    bandedChunk.set(chunk, 1);

    const length = bandedChunk.length + 4;
    const lengthHex = length.toString(16).padStart(4, '0');

    lines.push(concatArrays(encoder.encode(lengthHex), bandedChunk));
  }

  // Flush packet to indicate end
  lines.push(encoder.encode('0000'));

  return concatArrays(...lines);
}

/**
 * Generate /HEAD response
 */
export function generateHead(): string {
  return 'ref: refs/heads/main\n';
}

/**
 * Get object data by SHA from pack
 * Returns compressed object data suitable for HTTP response
 */
export function getObject(pack: GitPack, sha: string): Uint8Array | null {
  const obj = pack.objects.get(sha);
  return obj ? obj.data : null;
}

/**
 * Parse object path from URL
 * /objects/xx/yyyyyy... -> xxyyyyyy...
 */
export function parseObjectPath(path: string): string | null {
  const match = path.match(/objects\/([a-f0-9]{2})\/([a-f0-9]+)$/);
  if (match) {
    return match[1] + match[2];
  }
  return null;
}
