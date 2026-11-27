import { NextResponse } from "next/server";
import { SESSION_COOKIE, revokeAllSessions } from "@/lib/session";

export async function POST() {
  await revokeAllSessions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
