/**
 * サーバ側 Supabase クライアント（Server Components / Route Handlers 用）
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // Server Component から呼び出された場合の例外を握りつぶす
            // middleware でセッション更新する前提
          }
        },
      },
    }
  );
}

/**
 * サーバ側 Service Role クライアント
 * RLS をバイパスする・Admin Console 操作 / バッチ処理で使用
 * **絶対に Client Components から呼ばない**
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
