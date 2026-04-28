/**
 * Admin: 新規アカウント発行
 * POST /api/admin/accounts
 *   body: { email, name, company_name }
 *
 * 1. 呼び出し元が admin であることを確認
 * 2. Supabase Admin API で auth.users 作成 + Magic Link 招待メール送信
 * 3. public.accounts に role='user', status='active' で挿入
 * 4. admin_audit_log に記録
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // 認証 + 権限チェック
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("accounts")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!caller || caller.role !== "admin" || caller.status !== "active") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // バリデーション
  let body: { email?: string; name?: string; company_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const email = body.email?.trim();
  const name = body.name?.trim();
  const company_name = body.company_name?.trim();
  if (!email || !name || !company_name) {
    return NextResponse.json(
      { error: "email / name / company_name は必須" },
      { status: 400 }
    );
  }

  // service_role クライアントで管理操作
  const admin = createServiceRoleClient();

  // 招待メール送信（auth.users 作成も内部で行われる）
  const origin = new URL(request.url).origin;
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${origin}/auth/callback`,
    }
  );

  if (inviteErr) {
    // 既存ユーザーの場合のエラーハンドリング
    if (inviteErr.message?.includes("already") || inviteErr.status === 422) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `招待失敗: ${inviteErr.message}` },
      { status: 500 }
    );
  }

  const newUserId = invited.user?.id;
  if (!newUserId) {
    return NextResponse.json({ error: "ユーザーID取得失敗" }, { status: 500 });
  }

  // accounts に挿入（service_role なので RLS バイパス）
  const { error: insertErr } = await admin.from("accounts").insert({
    id: newUserId,
    email,
    name,
    company_name,
    role: "user",
    status: "active",
  });

  if (insertErr) {
    // ロールバック: auth ユーザーを削除
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `アカウント作成失敗: ${insertErr.message}` },
      { status: 500 }
    );
  }

  // 監査ログ
  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "create",
    target_account_id: newUserId,
    details: { email, name, company_name },
  });

  return NextResponse.json({ id: newUserId, email, name, company_name });
}
