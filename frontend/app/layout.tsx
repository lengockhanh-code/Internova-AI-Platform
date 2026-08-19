import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internova",
  description: "Nền tảng hỗ trợ thực tập bằng AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        {children}
      </body>
    </html>
  );
}
