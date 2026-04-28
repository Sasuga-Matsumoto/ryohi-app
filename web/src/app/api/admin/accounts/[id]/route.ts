/**
 * Admin: アカウント停止・再開・削除
 * PATCH /api/admin/accounts/[id]
 *   body: { action: 'suspend' | 'resume' | 'delete', reason?: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

type Action = "suspend" | "resume" | "delete";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 認証 + admin 権限チェック
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
  let body: { action?: Action; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const { action, reason } = body;
  if (!action || !["suspend", "resume", "delete"].includes(action)) {
    return NextResponse.json({ error: "action 不正" }, { status: 400 });
  }
  if (action === "delete" && !reason) {
    return NextResponse.json(
      { error: "削除には理由が必須" },
      { status: 400 }
    );
  }

  // 自分自身の操作を禁止
  if (id === user.id) {
    return NextResponse.json(
      { error: "自分自身に対する操作はできません" },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();

  // 状態更新
  const updates: Record<string, unknown> = {};
  if (action === "suspend") {
    updates.status = "suspended";
    updates.suspended_at = new Date().toISOString();
    updates.suspended_reason = reason ?? null;
  } else if (action === "resume") {
    updates.status = "active";
    updates.suspended_at = null;
    updates.suspended_reason = null;
  } else if (action === "delete") {
    updates.status = "deleted";
    updates.suspended_reason = reason ?? null;
  }

  const { error: updateErr } = await admin
    .from("accounts")
    .update(updates)
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json(
      { error: `更新失敗: ${updateErr.message}` },
      { status: 500 }
    );
  }

  // 停止・削除時は Supabase Auth セッションも無効化（サインアウト）
  if (action === "suspend" || action === "delete") {
    await admin.auth.admin.signOut(id, "global").catch(() => {
      // セッション無効化失敗は致命的でないので無視
    });
  }

  // 監査ログ
  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action,
    target_account_id: id,
    details: reason ? { reason } : {},
  });

  return NextResponse.json({ ok: true, action });
}
