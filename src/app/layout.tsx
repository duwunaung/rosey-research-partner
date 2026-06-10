import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus Research Partner | Cybernetic AI Assistant",
  description: "Track, scrape, prioritize, and summarize web research into offline PDF digests with LLMs.",
  metadataBase: new URL("https://rosey-research-partner.vercel.app"),
  openGraph: {
    title: "Nexus Research Partner | Cybernetic AI Assistant",
    description: "Track, scrape, prioritize, and summarize web research into offline PDF digests with LLMs.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable} dark`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-[#030303] text-[#f4f4f5] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
