-- Download Tokens for Short Link System
-- Enables third-party CLIs (skills.sh, openskills) to download skills via short URLs

-- download_tokens 表：短期下载令牌
CREATE TABLE download_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 令牌标识
  short_code    TEXT UNIQUE NOT NULL,      -- 6位短码（如 "x7Kp2Q"）
  token_hash    TEXT UNIQUE NOT NULL,      -- 完整令牌的 SHA256 哈希

  -- 关联信息
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id       UUID,                       -- 可为空（匿名用户）或关联到用户

  -- 安全控制
  expires_at    TIMESTAMPTZ NOT NULL,      -- 过期时间（默认 10 分钟）
  max_uses      INTEGER DEFAULT 5,         -- 最大使用次数（Git clone 需要多次请求）
  use_count     INTEGER DEFAULT 0,         -- 已使用次数

  -- 使用记录
  last_used_at  TIMESTAMPTZ,
  last_used_ip  TEXT,                      -- 最后使用的 IP（审计用）

  -- 元数据
  purpose       TEXT DEFAULT 'git_clone',  -- 用途：'git_clone', 'tarball', 'direct'
  client_info   JSONB,                     -- 客户端信息

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_download_tokens_short_code ON download_tokens(short_code);
CREATE INDEX idx_download_tokens_token_hash ON download_tokens(token_hash);
CREATE INDEX idx_download_tokens_skill_id ON download_tokens(skill_id);
CREATE INDEX idx_download_tokens_user_id ON download_tokens(user_id);
CREATE INDEX idx_download_tokens_expires_at ON download_tokens(expires_at);

-- 启用 RLS
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的令牌
CREATE POLICY "Users can view own download tokens" ON download_tokens
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- 服务端通过 service role key 创建令牌（绕过 RLS）
-- 前端无法直接创建，必须通过 API

-- 用户可以删除自己的令牌
CREATE POLICY "Users can delete own download tokens" ON download_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- 服务端可以更新使用计数（通过 service role key）
-- 注意：use_download_token 函数使用 SECURITY DEFINER，绕过 RLS

-- 验证并使用令牌的函数（原子操作，防止竞态条件）
CREATE OR REPLACE FUNCTION use_download_token(
  p_short_code TEXT,
  p_client_ip TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  skill_id UUID,
  error_code TEXT
) AS $$
DECLARE
  v_token RECORD;
BEGIN
  -- 锁定并更新令牌（原子操作）
  UPDATE download_tokens
  SET
    use_count = use_count + 1,
    last_used_at = NOW(),
    last_used_ip = COALESCE(p_client_ip, last_used_ip)
  WHERE short_code = p_short_code
    AND expires_at > NOW()
    AND use_count < max_uses
  RETURNING * INTO v_token;

  IF FOUND THEN
    -- 成功
    RETURN QUERY SELECT TRUE, v_token.skill_id, NULL::TEXT;
    RETURN;
  END IF;

  -- 失败：检查具体原因
  SELECT * INTO v_token FROM download_tokens WHERE short_code = p_short_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'not_found'::TEXT;
  ELSIF v_token.expires_at <= NOW() THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, 'expired'::TEXT;
  ELSIF v_token.use_count >= v_token.max_uses THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, 'exhausted'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, v_token.skill_id, 'unknown'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 验证令牌（不消耗使用次数，用于预检）
CREATE OR REPLACE FUNCTION verify_download_token(p_short_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  skill_id UUID,
  remaining_uses INTEGER,
  expires_at TIMESTAMPTZ,
  error_code TEXT
) AS $$
DECLARE
  v_token RECORD;
BEGIN
  SELECT * INTO v_token FROM download_tokens WHERE short_code = p_short_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::TIMESTAMPTZ, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_token.expires_at <= NOW() THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, 0, v_token.expires_at, 'expired'::TEXT;
    RETURN;
  END IF;

  IF v_token.use_count >= v_token.max_uses THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, 0, v_token.expires_at, 'exhausted'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    TRUE,
    v_token.skill_id,
    v_token.max_uses - v_token.use_count,
    v_token.expires_at,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期令牌
CREATE OR REPLACE FUNCTION cleanup_expired_download_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除过期超过 1 小时的令牌
  DELETE FROM download_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 删除已用完且超过 1 小时的令牌
  DELETE FROM download_tokens
  WHERE use_count >= max_uses
    AND last_used_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 速率限制表（可选，用于防止暴力破解）
CREATE TABLE IF NOT EXISTS token_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    TEXT NOT NULL,
  endpoint      TEXT NOT NULL,             -- 'git_clone', 'token_generate'
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,

  UNIQUE(ip_address, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_ip_endpoint ON token_rate_limits(ip_address, endpoint);
CREATE INDEX idx_rate_limits_window ON token_rate_limits(window_start);

-- 检查并增加速率限制计数
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_record RECORD;
BEGIN
  -- 计算当前窗口开始时间
  v_window_start := date_trunc('second', NOW()) -
    ((EXTRACT(EPOCH FROM NOW())::INTEGER % p_window_seconds) * INTERVAL '1 second');

  -- 尝试插入或更新
  INSERT INTO token_rate_limits (ip_address, endpoint, window_start, request_count)
  VALUES (p_ip_address, p_endpoint, v_window_start, 1)
  ON CONFLICT (ip_address, endpoint, window_start)
  DO UPDATE SET request_count = token_rate_limits.request_count + 1
  RETURNING * INTO v_record;

  RETURN QUERY SELECT
    v_record.request_count <= p_max_requests,
    GREATEST(0, p_max_requests - v_record.request_count),
    v_window_start + (p_window_seconds * INTERVAL '1 second');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理旧的速率限制记录
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM token_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
