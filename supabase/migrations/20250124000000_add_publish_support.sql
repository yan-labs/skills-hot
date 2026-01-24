-- Add publish support for CLI direct publishing
-- Skills can now be published directly by authenticated users

-- 1. Add new columns to skills table
ALTER TABLE skills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS storage_path TEXT;  -- Supabase Storage path for ZIP package
ALTER TABLE skills ADD COLUMN IF NOT EXISTS has_files BOOLEAN DEFAULT FALSE;

-- 2. Create index for user_id
CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);

-- 3. Update RLS policies for skills table
-- Allow authenticated users to insert skills they own
CREATE POLICY "Users can insert their own skills" ON skills
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (user_id IS NULL OR user_id = auth.uid())
  );

-- Allow users to update their own skills
CREATE POLICY "Users can update their own skills" ON skills
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid()
  );

-- Allow users to delete their own skills
CREATE POLICY "Users can delete their own skills" ON skills
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid()
  );

-- 4. Create skill_packages bucket for storing ZIP files
-- Note: This needs to be configured in Supabase Dashboard or config.toml
-- Bucket name: skill-packages
-- Public: true (for download)
-- File size limit: 50MB
-- Allowed MIME types: application/zip, application/x-zip-compressed

-- 5. Storage policies (run these after creating the bucket)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('skill-packages', 'skill-packages', true, 52428800)
-- ON CONFLICT (id) DO NOTHING;
