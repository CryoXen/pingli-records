/**
 * El panel de admin llama aquí después de guardar: la portada se vuelve a
 * armar con el contenido nuevo. Solo funciona con la sesión de un admin.
 */
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ ok: false }, { status: 401 });
  const sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.rpc("es_admin");
  if (error || data !== true) return Response.json({ ok: false }, { status: 403 });
  revalidatePath("/");
  return Response.json({ ok: true });
}
