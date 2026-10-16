import type { Metadata } from "next";
import "./life.css";

export const metadata: Metadata = {
  title: "Life OS · 个人生命系统",
  description: "了解自己，让重要的事每天前进一小步。支持账号登录与云端同步。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
