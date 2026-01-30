#!/usr/bin/env node
/**
 * Skills Hot 定时同步器
 *
 * 功能：
 * - 每小时运行一次数据同步和快照
 * - 避免重复执行（任务未完成时跳过）
 * - 自动记录日志
 * - 一键启动，持续运行
 *
 * 用法: node scripts/scheduler.mjs
 */

import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', '.logs');
const LOG_FILE = join(LOG_DIR, 'scheduler.log');

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  process.stdout.write(line);
  appendFileSync(LOG_FILE, line);
}

// 任务状态
let isRunning = false;
let lastRunTime = null;
let runCount = 0;

// 执行同步脚本
async function runSync() {
  log('🔄 开始数据同步...');

  const startTime = Date.now();

  try {
    const { spawn } = await import('child_process');

    await new Promise((resolve, reject) => {
      const proc = spawn('node', ['scripts/sync-skills-sh.mjs'], {
        env: {
          ...process.env,
          SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        },
        stdio: 'inherit',
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`sync-skills-sh.mjs 退出码: ${code}`));
        }
      });

      proc.on('error', reject);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ 数据同步完成 (耗时: ${elapsed}s)`);
    return true;
  } catch (error) {
    log(`❌ 数据同步失败: ${error.message}`);
    return false;
  }
}

// 执行快照脚本
async function runSnapshot() {
  log('📸 开始生成快照...');

  const startTime = Date.now();

  try {
    const { spawn } = await import('child_process');

    await new Promise((resolve, reject) => {
      const proc = spawn('node', ['scripts/snapshot.mjs'], {
        env: {
          ...process.env,
          SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        },
        stdio: 'inherit',
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`snapshot.mjs 退出码: ${code}`));
        }
      });

      proc.on('error', reject);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ 快照生成完成 (耗时: ${elapsed}s)`);
    return true;
  } catch (error) {
    log(`❌ 快照生成失败: ${error.message}`);
    return false;
  }
}

// 主任务
async function runTask() {
  if (isRunning) {
    log('⏸️  上次任务仍在运行，跳过本次执行');
    return;
  }

  isRunning = true;
  runCount++;
  lastRunTime = new Date();

  log(`\n${'='.repeat(60)}`);
  log(`🚀 开始第 ${runCount} 次定时任务`);
  log(`执行时间: ${lastRunTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  log(`${'='.repeat(60)}`);

  const syncOk = await runSync();

  // 同步成功后才生成快照
  if (syncOk) {
    await runSnapshot();
  } else {
    log('⚠️  数据同步失败，跳过快照生成');
  }

  const elapsed = ((Date.now() - lastRunTime.getTime()) / 1000).toFixed(1);
  log(`🎁 本次任务完成，耗时: ${elapsed}s\n`);

  isRunning = false;
}

// 计算下次执行时间（每小时整点前 20 分钟，如 14:40, 15:40）
function getNextRunTime() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(40, 0, 0);

  // 如果当前时间已经过了今天的 40 分，就设置到下一小时的 40 分
  if (now.getMinutes() >= 40 && now.getHours() === next.getHours()) {
    next.setHours(now.getHours() + 1);
  }

  return next;
}

// 格式化倒计时
function formatCountdown(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}分${seconds}秒`;
}

// 显示倒计时
let countdownInterval = null;

function startCountdown(nextRunTime) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    const now = new Date();
    const diff = nextRunTime - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      return;
    }

    // 每分钟更新一次
    if (now.getSeconds() === 0) {
      process.stdout.write(`\r⏰ 下次执行: ${nextRunTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} (倒计时: ${formatCountdown(diff)})   `);
    }
  }, 1000);
}

// 启动定时器
function startScheduler() {
  const nextRunTime = getNextRunTime();

  log('\n' + '='.repeat(60));
  log('🕐 Skills Hot 定时同步器启动');
  log('='.repeat(60));
  log(`启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  log(`下次执行: ${nextRunTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);
  log(`间隔: 每小时整点`);
  log(`日志文件: ${LOG_FILE}`);
  log('='.repeat(60) + '\n');

  // 首次启动时不执行任务，等待下一个整点
  const delay = nextRunTime - Date.now();

  log(`⏳ 等待首次执行... (${formatCountdown(delay)})\n`);

  setTimeout(() => {
    // 立即执行第一次
    runTask().then(() => {
      // 之后每小时执行一次
      const hourlyInterval = 3600000; // 1 小时

      setInterval(() => {
        runTask();
      }, hourlyInterval);

      log('✅ 定时器已设置，每小时整点执行\n');
    });
  }, delay);

  // 启动倒计时显示
  startCountdown(nextRunTime);
}

// 优雅退出
process.on('SIGINT', () => {
  log('\n\n👋 收到退出信号，定时器停止');
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n\n👋 收到终止信号，定时器停止');
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  process.exit(0);
});

// 启动
startScheduler();
