import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DIKSHA Courses — Complete Courses Automatically",
  description: "Automate your DIKSHA learning journey & course completions smoothly.",
  icons: {
    icon: "/diksha-logo.png",
    shortcut: "/diksha-logo.png",
    apple: "/diksha-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
