-- skills.sh 数据缓存表
-- 用于存储从 skills.sh 同步的安装量数据，作为搜索结果的增强层

CREATE TABLE IF NOT EXISTS skills_sh_cache (
  name TEXT PRIMARY KEY,
  installs INTEGER DEFAULT 0,
  top_source TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 安装量索引，用于排序
CREATE INDEX IF NOT EXISTS idx_skills_sh_cache_installs
  ON skills_sh_cache(installs DESC);

-- 更新时间索引，用于清理过期数据
CREATE INDEX IF NOT EXISTS idx_skills_sh_cache_synced_at
  ON skills_sh_cache(synced_at);
