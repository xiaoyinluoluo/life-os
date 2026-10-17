import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("请配置 Supabase 项目地址和公开密钥。");

export const supabase = createClient(url, anonKey);
export async function lifeFetch(command?: unknown, version?: number): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({error:"请先登录。"}, {status:401});
  return fetch(url + "/functions/v1/life", {
    method: command ? "POST" : "GET",
    headers: {
      authorization: "Bearer " + session.access_token,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: command ? JSON.stringify({command, version}) : undefined,
    cache:"no-store",
  });
}
