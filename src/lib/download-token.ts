/**
 * Download Token Utilities
 * Generates short-lived tokens for third-party CLI downloads
 */

// Base62 字符集（排除易混淆字符：0/O, 1/l/I）
const BASE62_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * 生成随机短码
 * 6 位 Base62 = 62^6 ≈ 56.8 亿种组合
 */
export function generateShortCode(length: number = 6): string {
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => BASE62_CHARS[byte % BASE62_CHARS.length]).join('');
}

/**
 * 生成完整下载令牌
 * 格式: dt_{shortCode}_{randomSuffix}
 * 例如: dt_x7Kp2Q_a1B2c3D4e5F6g7H8
 *
 * @returns shortCode 用于短链接，fullToken 用于验证
 */
export function generateDownloadToken(): { shortCode: string; fullToken: string } {
  const shortCode = generateShortCode(6);
  const randomSuffix = generateShortCode(16);
  const fullToken = `dt_${shortCode}_${randomSuffix}`;

  return { shortCode, fullToken };
}

/**
 * 从完整令牌提取短码
 */
export function extractShortCode(fullToken: string): string | null {
  const match = fullToken.match(/^dt_([A-Za-z0-9]{6})_/);
  return match ? match[1] : null;
}

/**
 * 验证短码格式
 */
export function isValidShortCode(code: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(code);
}

/**
 * 计算令牌的 SHA-256 哈希
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 过期时间配置（毫秒）
 */
export const TOKEN_EXPIRY = {
  /** 默认 10 分钟 */
  DEFAULT: 10 * 60 * 1000,
  /** 扩展 30 分钟（用于大文件） */
  EXTENDED: 30 * 60 * 1000,
  /** 最大 1 小时 */
  MAX: 60 * 60 * 1000,
  /** 最小 1 分钟 */
  MIN: 1 * 60 * 1000,
} as const;

/**
 * 使用次数配置
 */
export const TOKEN_USES = {
  /** 一次性（最安全） */
  SINGLE: 1,
  /** Git clone 默认（Git 会发多个请求） */
  GIT_CLONE: 5,
  /** Tarball 下载 */
  TARBALL: 2,
  /** 最大值 */
  MAX: 20,
} as const;

/**
 * 令牌用途类型
 */
export type TokenPurpose = 'git_clone' | 'tarball' | 'direct';

/**
 * 生成下载链接的参数
 */
export interface CreateTokenParams {
  skillId: string;
  userId: string | null;
  expiresIn?: number; // 秒
  maxUses?: number;
  purpose?: TokenPurpose;
  clientInfo?: Record<string, unknown>;
}

/**
 * 生成下载链接的结果
 */
export interface CreateTokenResult {
  shortCode: string;
  fullToken: string;
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
}

/**
 * 准备创建令牌所需的数据
 */
export async function prepareTokenData(params: CreateTokenParams): Promise<CreateTokenResult> {
  const { shortCode, fullToken } = generateDownloadToken();
  const tokenHash = await hashToken(fullToken);

  // 计算过期时间
  const expiresInMs = params.expiresIn
    ? Math.min(Math.max(params.expiresIn * 1000, TOKEN_EXPIRY.MIN), TOKEN_EXPIRY.MAX)
    : TOKEN_EXPIRY.DEFAULT;

  const expiresAt = new Date(Date.now() + expiresInMs);

  // 计算使用次数
  const maxUses = params.maxUses
    ? Math.min(Math.max(params.maxUses, 1), TOKEN_USES.MAX)
    : params.purpose === 'git_clone'
      ? TOKEN_USES.GIT_CLONE
      : params.purpose === 'tarball'
        ? TOKEN_USES.TARBALL
        : TOKEN_USES.SINGLE;

  return {
    shortCode,
    fullToken,
    tokenHash,
    expiresAt,
    maxUses,
  };
}

/**
 * 构建短链接 URL
 */
export function buildShortUrl(shortCode: string, baseUrl?: string): {
  shortUrl: string;
  gitUrl: string;
  tarballUrl: string;
} {
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://skills.hot';

  return {
    shortUrl: `${base}/g/${shortCode}`,
    gitUrl: `${base}/g/${shortCode}.git`,
    tarballUrl: `${base}/g/${shortCode}/archive.tar.gz`,
  };
}

/**
 * 格式化剩余时间
 */
export function formatTimeRemaining(expiresAt: Date | string): string {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const diff = expiry.getTime() - Date.now();

  if (diff <= 0) return 'expired';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
