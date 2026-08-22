import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/context/settings-provider";

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
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}

