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
  title: "Cirkle Brain AI — Cognitive Widget",
  description:
    "A model-independent cognitive operating layer. The LLM is one replaceable component; the Brain owns identity, memory, knowledge, evidence, retrieval, context, tools, policy, verification, learning, observability, cost, audit.",
  keywords: ["Cirkle", "Brain", "cognitive platform", "model-independent", "Next.js", "AI"],
  authors: [{ name: "Cirkle CTO Office" }],
  icons: {
    icon: [
      { url: "/cirkle-mark.svg", type: "image/svg+xml" },
      { url: "/cirkle-favicon.ico", type: "image/x-icon", sizes: "256x256" },
    ],
    shortcut: "/cirkle-mark.svg",
    apple: "/cirkle-favicon.ico",
  },
  openGraph: {
    title: "Cirkle Brain AI",
    description: "Model-independent cognitive operating layer",
    siteName: "Cirkle",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Cirkle Brain AI",
    description: "Model-independent cognitive operating layer",
    images: [],
  },
};

export const viewport: Viewport = {
  themeColor: "#C2A060",
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
