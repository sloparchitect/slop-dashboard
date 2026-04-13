import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { PAGE_TITLE } from "@/lib/config";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: "Cross-platform shorts intelligence for YouTube + TikTok",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex flex-col lg:flex-row min-h-screen">
          <Nav />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 max-w-[1600px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
