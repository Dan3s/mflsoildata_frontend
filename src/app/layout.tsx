import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import { SITE_TITLE } from "@/app/config";
import { auth } from "@/auth";
import ChatWidget from "@/app/components/ChatWidget";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  description:
    "Frontend inicial para visualización de información climática y de suelo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const session = await auth();

  return (
    <html lang={locale}>
      <body className={`${montserrat.variable} antialiased`}>
        <NextIntlClientProvider>
          <SessionProvider session={session}>
            <main className="min-h-screen">{children}</main>
            <ChatWidget />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}