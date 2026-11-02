// 132총국 웹앱 · 로그인 계정 관리 (관리자 전용)
// 웹앱 「권한 관리 → 사람 추가」에서 호출: 로그인 계정 만들기 · 비밀번호 초기화 · 계정 삭제 · 계정 상태 목록
// 보안: 호출한 사람의 로그인 토큰을 확인하고, app_users 에 관리자 역할로 등록된 사람만 허용
//       계정은 app_users(사람 목록)에 먼저 등록된 이메일만 만들 수 있음
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const findUser = async (email: string) => {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST만 지원합니다" });
  try {
    // 1) 호출한 사람 확인
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "로그인이 필요합니다" });
    const { data: me, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !me?.user) return json(401, { error: "로그인이 만료됐습니다 · 다시 로그인해 주세요" });
    const { data: row } = await admin.from("app_users").select("email, name, active, role_id, app_roles(menus)").eq("user_id", me.user.id).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const menus: string[] = ((row as any)?.app_roles?.menus) || [];
    if (!row || !row.active || !menus.includes("admin")) return json(403, { error: "관리자만 할 수 있습니다" });
    const actor = row.name || row.email;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const email = String(body.email || "").trim().toLowerCase();

    if (action === "list") {
      const out: Record<string, unknown>[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        data.users.forEach((u) => out.push({ email: (u.email || "").toLowerCase(), created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, must_change: !!u.user_metadata?.must_change }));
        if (data.users.length < 200) break;
      }
      return json(200, { users: out });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "값을 입력해주세요 (이메일)" });
    const { data: target } = await admin.from("app_users").select("email, user_id").eq("email", email).maybeSingle();

    if (action === "create" || action === "reset") {
      const password = String(body.password || "");
      if (password.length < 8) return json(400, { error: "비밀번호는 8자 이상이어야 합니다" });
      if (!target) return json(400, { error: "먼저 사람 목록에 등록된 이메일만 계정을 만들 수 있습니다" });
      let u = await findUser(email);
      if (action === "create" && !u) {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { must_change: true } });
        if (error) throw error;
        u = data.user;
      } else if (u) {
        const { error } = await admin.auth.admin.updateUserById(u.id, { password, user_metadata: { ...(u.user_metadata || {}), must_change: true } });
        if (error) throw error;
      } else return json(404, { error: "로그인 계정이 없습니다 · 「계정 만들기」를 먼저 하세요" });
      await admin.from("app_users").update({ user_id: u!.id }).eq("email", email);
      await admin.from("change_log").insert({ actor, target: "access_rules", summary: "웹앱 로그인 계정 " + (action === "create" ? "만들기" : "비밀번호 초기화") + " · " + email, detail: { email } });
      return json(200, { ok: true, email, created: action === "create" });
    }
    if (action === "delete") {
      if (email === (me.user.email || "").toLowerCase()) return json(400, { error: "본인 계정은 삭제할 수 없습니다" });
      const u = await findUser(email);
      if (u) { const { error } = await admin.auth.admin.deleteUser(u.id); if (error) throw error; }
      await admin.from("change_log").insert({ actor, target: "access_rules", summary: "웹앱 로그인 계정 삭제 · " + email, detail: { email } });
      return json(200, { ok: true, email, deleted: !!u });
    }
    return json(400, { error: "알 수 없는 요청입니다" });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) });
  }
});
