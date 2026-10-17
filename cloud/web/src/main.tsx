import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import LifeApp from "./life-app";
import { supabase } from "./client";
import "./life.css";
import "./auth.css";

function App() {
  const [session, setSession] = useState<Session|null|undefined>(undefined);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  useEffect(()=>{
    void supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const link=(event.target as Element).closest("a");
      if (!link) return;
      if (link.getAttribute("href")?.startsWith("/signout-with-chatgpt")) {
        event.preventDefault();
        void supabase.auth.signOut();
      } else if (link.classList.contains("brand")) {
        event.preventDefault();
        location.href="/life-os/";
      }
    };
    document.addEventListener("click",onClick);
    return ()=>document.removeEventListener("click",onClick);
  },[]);
  async function submit(mode:"login"|"signup") {
    setBusy(true);setMessage("");
    try {
      const result = mode==="login"
        ? await supabase.auth.signInWithPassword({email,password})
        : await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}});
      if (result.error) throw result.error;
      if (mode==="signup" && !result.data.session) setMessage("注册已提交。请查收验证邮件，验证后再登录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败，请稍后重试。");
    } finally {setBusy(false)}
  }
  if (session===undefined) return <div className="auth-shell">正在检查登录状态…</div>;
  if (session) return <LifeApp/>;
  return <div className="auth-shell"><div className="auth-card">
    <div className="auth-brand">🌱 Life <b>OS</b></div>
    <h1>登录个人生命系统</h1>
    <p>同一账号，跨设备查看和保存目标、行动、复盘与笔记。</p>
    <form onSubmit={event=>{event.preventDefault();void submit("login")}}>
      <label>邮箱<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email"/></label>
      <label>密码<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required minLength={6} autoComplete="current-password"/></label>
      <button className="primary" disabled={busy}>登录</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>void submit("signup")}>注册新账号</button>
    </form>
    {message && <p role="alert">{message}</p>}
    <small>首次注册可能需要点击邮箱中的验证链接。请使用与你其他设备相同的邮箱和密码。</small>
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
