import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Indonesian Tax Calculator",
  description:
    "Interactive Indonesian tax calculator with transparent PPh 21 breakdowns.",
  openGraph: {
    title: "Indonesian Tax Calculator",
    description:
      "Interactive Indonesian tax calculator with transparent PPh 21 breakdowns.",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Indonesian Income Tax calculator hero",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Indonesian Tax Calculator",
    description:
      "Interactive Indonesian tax calculator with transparent PPh 21 breakdowns.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
