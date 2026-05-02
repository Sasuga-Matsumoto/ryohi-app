/**
 * POST /api/health
 *
 * モバイルアプリから現在のステータスを報告する。
 * Admin のアカウント詳細画面で「位置情報」KPI として表示される。
 */
import { NextResponse, type NextRequest } from "next/server";
import { getApiClient } from "@/lib/supabase/api-auth";

const VALID_STATUSES = [
  "services_off",
  "no_permission",
  "fg_only",
  "no_setting",
  "not_recording",
  "ready",
] as const;

type MobileStatus = (typeof VALID_STATUSES)[number];

export async function POST(request: NextRequest) {
  const supabase = await getApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as MobileStatus)) {
    return NextResponse.json({ error: "status が不正" }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      last_mobile_status: body.status as MobileStatus,
      last_health_check_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
