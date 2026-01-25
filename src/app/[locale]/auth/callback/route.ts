import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component - ignore
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Auto-link user to authors table if they logged in with GitHub
      const user = data.user;
      const githubId = user.user_metadata?.provider_id || user.user_metadata?.sub;
      const githubLogin = user.user_metadata?.user_name || user.user_metadata?.preferred_username;

      if (githubId && githubLogin) {
        try {
          // Use service role client for authors table operations
          const serviceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
              cookies: {
                getAll() {
                  return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                  try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                      cookieStore.set(name, value, options)
                    );
                  } catch {
                    // Server Component - ignore
                  }
                },
              },
            }
          );

          // Upsert author record
          await serviceSupabase.from('authors').upsert(
            {
              github_id: parseInt(githubId, 10),
              github_login: githubLogin,
              user_id: user.id,
              name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
            },
            {
              onConflict: 'github_id',
              ignoreDuplicates: false, // Update existing record
            }
          );
        } catch (authorError) {
          // Log but don't fail the auth flow
          console.error('Failed to upsert author:', authorError);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to home with error
  return NextResponse.redirect(`${origin}/auth/signin?error=Could not authenticate`);
}
