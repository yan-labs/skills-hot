-- ========================================
-- 支持 external_skills 的下载令牌
-- ========================================

-- 1. 移除原有的外键约束
ALTER TABLE download_tokens DROP CONSTRAINT IF EXISTS download_tokens_skill_id_fkey;

-- 2. 添加 external_skill_id 列（可选）
ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS external_skill_id UUID;

-- 3. 添加 skill_type 列来区分来源
ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS skill_type TEXT DEFAULT 'local';

-- 4. 修改约束：skill_id 或 external_skill_id 至少有一个
-- 注意：skill_id 现在可以为空
ALTER TABLE download_tokens ALTER COLUMN skill_id DROP NOT NULL;

-- 5. 添加检查约束确保至少有一个 ID
ALTER TABLE download_tokens ADD CONSTRAINT check_skill_reference
  CHECK (skill_id IS NOT NULL OR external_skill_id IS NOT NULL);

-- 6. 添加外键（可选，允许软关联）
-- 对于 local skills
ALTER TABLE download_tokens
  ADD CONSTRAINT fk_download_tokens_skill
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;

-- 对于 external skills
ALTER TABLE download_tokens
  ADD CONSTRAINT fk_download_tokens_external_skill
  FOREIGN KEY (external_skill_id) REFERENCES external_skills(id) ON DELETE CASCADE;

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS idx_download_tokens_external_skill_id
  ON download_tokens(external_skill_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_skill_type
  ON download_tokens(skill_type);
