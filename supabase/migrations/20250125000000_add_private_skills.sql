-- Add private skills support
-- Phase 1: Only owner can access private skills
-- Phase 2: Account-level authorization (future)
-- Phase 3: Per-skill authorization / purchase (future)

-- 1. Add is_private field to skills table
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- 2. Create index for filtering
CREATE INDEX IF NOT EXISTS idx_skills_is_private ON skills(is_private);
CREATE INDEX IF NOT EXISTS idx_skills_user_private ON skills(user_id, is_private);

-- 3. Create skill_access table for future authorization
-- This table tracks who has access to private skills
CREATE TABLE IF NOT EXISTS skill_access (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID REFERENCES skills(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type   TEXT DEFAULT 'view',  -- 'view', 'download', 'full'
  expires_at    TIMESTAMPTZ,          -- NULL = permanent
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_access_user ON skill_access(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_access_skill ON skill_access(skill_id);

-- 4. Enable RLS on skill_access
ALTER TABLE skill_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access records
CREATE POLICY "Users can view their own access" ON skill_access
  FOR SELECT USING (user_id = auth.uid());

-- Skill owners can manage access to their skills
CREATE POLICY "Owners can manage skill access" ON skill_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM skills
      WHERE skills.id = skill_access.skill_id
      AND skills.user_id = auth.uid()
    )
  );

-- 5. Update skills RLS policy to handle private skills
-- Drop the old public read policy
DROP POLICY IF EXISTS "Skills are publicly readable" ON skills;

-- Create new policy: public skills are readable by everyone,
-- private skills only by owner or authorized users
CREATE POLICY "Skills visibility policy" ON skills
  FOR SELECT USING (
    is_private = FALSE
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM skill_access
      WHERE skill_access.skill_id = skills.id
      AND skill_access.user_id = auth.uid()
      AND (skill_access.expires_at IS NULL OR skill_access.expires_at > NOW())
    )
  );

-- 6. Function to check if user has access to a skill
CREATE OR REPLACE FUNCTION has_skill_access(p_skill_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_skill RECORD;
BEGIN
  -- Get skill info
  SELECT is_private, user_id INTO v_skill
  FROM skills WHERE id = p_skill_id;

  -- Not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Public skill
  IF NOT v_skill.is_private THEN
    RETURN TRUE;
  END IF;

  -- Owner always has access
  IF v_skill.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check explicit access
  RETURN EXISTS (
    SELECT 1 FROM skill_access
    WHERE skill_id = p_skill_id
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
