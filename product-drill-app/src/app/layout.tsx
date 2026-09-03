import type { Metadata } from "next";
import "./globals.css";
import { RuntimeProviders } from "./runtime-providers";

export const metadata: Metadata = {
  title: "Product Drill · AI 产品发现训练场",
  description: "在真实业务情境中练习用户访谈、需求澄清和产品判断。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body suppressHydrationWarning><RuntimeProviders>{children}</RuntimeProviders></body></html>;
}
