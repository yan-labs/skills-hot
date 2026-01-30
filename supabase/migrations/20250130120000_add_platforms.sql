-- Add platforms field for skill runtime platform classification
-- Supports: claudecode, cursor, windsurf, codex, moltbot, manus, universal

-- Add platforms column to skills table
ALTER TABLE skills ADD COLUMN platforms TEXT[] DEFAULT '{universal}';

-- Add platforms column to external_skills table
ALTER TABLE external_skills ADD COLUMN platforms TEXT[] DEFAULT '{universal}';

-- Create index for filtering by platforms
CREATE INDEX idx_skills_platforms ON skills USING GIN(platforms);
CREATE INDEX idx_external_skills_platforms ON external_skills USING GIN(platforms);
