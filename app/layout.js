import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";
import CookieBanner from "./components/CookieBanner";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Beach Volley Institute",
  description: "Gestione tornei e iscrizioni Beach Volley Institute",
  manifest: "/manifest.json",
  icons: {
    apple: "/webapp-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BVI Tornei",
  },
};

export const viewport = {
  themeColor: "#0a1628",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
