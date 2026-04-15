import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offboarding Dashboard | Platinumlist",
  description: "Track and manage employee offboarding tasks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
