import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WEDJAT BRAIN V2 — Cognitive Widget",
  description:
    "A model-independent cognitive operating layer. The LLM is one replaceable component; the Brain owns identity, memory, knowledge, evidence, retrieval, context, tools, policy, verification, learning, observability, cost, audit.",
  keywords: ["WEDJAT", "Brain", "cognitive platform", "model-independent", "Next.js", "AI"],
  authors: [{ name: "Wedjat CTO Office" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: {
    title: "WEDJAT BRAIN V2",
    description: "Model-independent cognitive operating layer",
    siteName: "Wedjat",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
