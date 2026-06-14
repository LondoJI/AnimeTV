import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && session?.user) {
      const { user } = session;
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const username = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
      
      // Create profile row if it doesn't exist
      await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          username: username || `user_${user.id.substring(0, 5)}`,
          avatar_url: avatarUrl || null,
        }, { onConflict: 'id' });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
