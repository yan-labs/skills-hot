-- Add increment_stat RPC function
CREATE OR REPLACE FUNCTION increment_stat(p_skill_id UUID, p_column TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE skill_stats SET %I = %I + 1 WHERE skill_id = $1', p_column, p_column)
  USING p_skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION increment_stat(UUID, TEXT) TO anon;
