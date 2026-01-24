-- Device Flow Authentication for CLI
-- OAuth 2.0 Device Authorization Grant (RFC 8628)

-- device_codes 表：存储设备授权码
CREATE TABLE device_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code   TEXT UNIQUE NOT NULL,  -- CLI 用于轮询的设备码（长随机字符串）
  user_code     TEXT UNIQUE NOT NULL,  -- 用户在浏览器输入的短码（如 ABCD-1234）
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- 授权后关联的用户
  client_info   JSONB,                 -- CLI 客户端信息（版本、OS 等）
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'expired', 'used')),
  expires_at    TIMESTAMPTZ NOT NULL,
  authorized_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- cli_tokens 表：存储 CLI 的访问令牌
CREATE TABLE cli_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token_hash    TEXT UNIQUE NOT NULL,  -- 令牌的 SHA256 哈希（不存储明文）
  name          TEXT,                  -- 令牌名称（如 "MacBook Pro"）
  client_info   JSONB,                 -- 客户端信息
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,           -- NULL 表示不过期
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_device_codes_device_code ON device_codes(device_code);
CREATE INDEX idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX idx_device_codes_status ON device_codes(status);
CREATE INDEX idx_device_codes_expires_at ON device_codes(expires_at);
CREATE INDEX idx_cli_tokens_user_id ON cli_tokens(user_id);
CREATE INDEX idx_cli_tokens_token_hash ON cli_tokens(token_hash);

-- 启用 RLS
ALTER TABLE device_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cli_tokens ENABLE ROW LEVEL SECURITY;

-- device_codes 策略
-- 任何人都可以创建设备码（CLI 未登录时调用）
CREATE POLICY "Anyone can create device codes" ON device_codes
  FOR INSERT WITH CHECK (true);

-- 任何人都可以通过 device_code 查询（CLI 轮询用）
CREATE POLICY "Anyone can read device codes by device_code" ON device_codes
  FOR SELECT USING (true);

-- 已登录用户可以通过 user_code 更新（网站授权用）
CREATE POLICY "Authenticated users can update device codes" ON device_codes
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- cli_tokens 策略
-- 用户只能看自己的令牌
CREATE POLICY "Users can view their own tokens" ON cli_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能创建自己的令牌
CREATE POLICY "Users can create their own tokens" ON cli_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的令牌
CREATE POLICY "Users can update their own tokens" ON cli_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的令牌
CREATE POLICY "Users can delete their own tokens" ON cli_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- 清理过期的设备码（可以通过 cron job 或 pg_cron 定期执行）
CREATE OR REPLACE FUNCTION cleanup_expired_device_codes()
RETURNS void AS $$
BEGIN
  UPDATE device_codes
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  -- 删除 7 天前的记录
  DELETE FROM device_codes
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
