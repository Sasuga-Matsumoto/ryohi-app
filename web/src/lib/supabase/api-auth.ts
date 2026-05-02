/**
 * API ルート用のクライアント取得ヘルパー
 *
 * モバイル (Authorization: Bearer <jwt>) と Web (cookie) の両方に対応:
 * - Bearer 認証あり: 与えられた JWT で認証されたクライアントを返す（RLS は user として動く）
 * - Bearer 認証なし: 既存の cookie ベースクライアントにフォールバック
 */
import { type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

export async function getApiClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const jwt = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (jwt) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  return createCookieClient();
}
