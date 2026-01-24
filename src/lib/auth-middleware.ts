import { createClient } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: { code: string; message: string } | null;
}

/**
 * Verify CLI token from Authorization header
 * Token format: Bearer sb_xxxxx
 */
export async function verifyToken(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader) {
    return {
      user: null,
      error: { code: 'unauthorized', message: 'Authorization header is required' },
    };
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return {
      user: null,
      error: { code: 'invalid_token', message: 'Invalid authorization header format' },
    };
  }

  const token = parts[1];

  // Validate token format
  if (!token.startsWith('sb_')) {
    return {
      user: null,
      error: { code: 'invalid_token', message: 'Invalid token format' },
    };
  }

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      user: null,
      error: { code: 'server_error', message: 'Server configuration error' },
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Hash the token to compare with stored hash
  const tokenHash = await hashToken(token);

  // Look up token in cli_tokens table
  const { data: tokenData, error: tokenError } = await supabase
    .from('cli_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();

  if (tokenError || !tokenData) {
    return {
      user: null,
      error: { code: 'invalid_token', message: 'Token not found or invalid' },
    };
  }

  // Check if token is revoked
  if (tokenData.revoked_at) {
    return {
      user: null,
      error: { code: 'invalid_token', message: 'Token has been revoked' },
    };
  }

  // Check if token is expired
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return {
      user: null,
      error: { code: 'invalid_token', message: 'Token has expired' },
    };
  }

  // Update last_used_at
  await supabase
    .from('cli_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  // Get user information
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
    tokenData.user_id
  );

  if (userError || !userData.user) {
    return {
      user: null,
      error: { code: 'server_error', message: 'Failed to get user information' },
    };
  }

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email || '',
      name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || '',
    },
    error: null,
  };
}

/**
 * Hash token using SHA-256
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
