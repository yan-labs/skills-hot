-- Fix RLS infinite recursion between skills and skill_access tables
-- The problem: skills policy checks skill_access, skill_access policy checks skills -> infinite loop

-- 1. Drop the problematic policies
DROP POLICY IF EXISTS "Skills visibility policy" ON skills;
DROP POLICY IF EXISTS "Owners can manage skill access" ON skill_access;

-- 2. Create a SECURITY DEFINER function to check skill ownership
-- This function bypasses RLS, breaking the recursion cycle
CREATE OR REPLACE FUNCTION is_skill_owner(p_skill_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM skills
    WHERE id = p_skill_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create a SECURITY DEFINER function to check skill access
-- This also bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION has_skill_access_direct(p_skill_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM skill_access
    WHERE skill_id = p_skill_id
    AND user_id = auth.uid()
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Recreate skills visibility policy using the SECURITY DEFINER function
-- This avoids querying skill_access directly in the policy
CREATE POLICY "Skills visibility policy" ON skills
  FOR SELECT USING (
    is_private = FALSE
    OR user_id = auth.uid()
    OR has_skill_access_direct(id)
  );

-- 5. Recreate skill_access policy using the SECURITY DEFINER function
-- This avoids querying skills directly in the policy
CREATE POLICY "Owners can manage skill access" ON skill_access
  FOR ALL USING (
    user_id = auth.uid()
    OR is_skill_owner(skill_id)
  );

-- 6. Add comment explaining the fix
COMMENT ON FUNCTION is_skill_owner IS 'Check if current user owns a skill. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';
COMMENT ON FUNCTION has_skill_access_direct IS 'Check if current user has access to a skill. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';
