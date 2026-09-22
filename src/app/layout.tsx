import type { Metadata, Viewport } from "next";
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
  icons: {
    icon: [
      { url: "/wedjat-favicon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/wedjat-favicon.png",
    apple: "/wedjat-favicon.png",
  },
  openGraph: {
    title: "WEDJAT BRAIN V2",
    description: "Model-independent cognitive operating layer",
    siteName: "Wedjat",
    type: "website",
    images: [{ url: "/wedjat-logo.png", width: 595, height: 477, alt: "WEDJAT Eye of Horus" }],
  },
  twitter: {
    card: "summary",
    title: "WEDJAT BRAIN V2",
    description: "Model-independent cognitive operating layer",
    images: ["/wedjat-logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#00D9FF",
  colorScheme: "dark light",
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
