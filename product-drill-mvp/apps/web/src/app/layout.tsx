import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Drill MVP",
  description: "AI 产品思维训练平台"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
