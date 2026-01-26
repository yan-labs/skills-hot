-- ========================================
-- 更新 download token 函数支持 external_skills
-- ========================================

-- 更新 use_download_token 函数
CREATE OR REPLACE FUNCTION use_download_token(
  p_short_code TEXT,
  p_client_ip TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  skill_id UUID,
  external_skill_id UUID,
  skill_type TEXT,
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
    RETURN QUERY SELECT
      TRUE,
      v_token.skill_id,
      v_token.external_skill_id,
      COALESCE(v_token.skill_type, 'local')::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- 失败：检查具体原因
  SELECT * INTO v_token FROM download_tokens WHERE short_code = p_short_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TEXT, 'not_found'::TEXT;
  ELSIF v_token.expires_at <= NOW() THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, v_token.external_skill_id, v_token.skill_type, 'expired'::TEXT;
  ELSIF v_token.use_count >= v_token.max_uses THEN
    RETURN QUERY SELECT FALSE, v_token.skill_id, v_token.external_skill_id, v_token.skill_type, 'exhausted'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, v_token.skill_id, v_token.external_skill_id, v_token.skill_type, 'unknown'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 verify_download_token 函数
CREATE OR REPLACE FUNCTION verify_download_token(p_short_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  skill_id UUID,
  external_skill_id UUID,
  skill_type TEXT,
  remaining_uses INTEGER,
  expires_at TIMESTAMPTZ,
  purpose TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (dt.expires_at > NOW() AND dt.use_count < dt.max_uses) AS is_valid,
    dt.skill_id,
    dt.external_skill_id,
    COALESCE(dt.skill_type, 'local')::TEXT AS skill_type,
    (dt.max_uses - dt.use_count) AS remaining_uses,
    dt.expires_at,
    dt.purpose
  FROM download_tokens dt
  WHERE dt.short_code = p_short_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
