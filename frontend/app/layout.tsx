import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="vi" suppressHydrationWarning>
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
        <Script id="internova-language-bootstrap" strategy="beforeInteractive">
          {`try {
            var savedLocale = localStorage.getItem("internova_locale");
            var selectedLocale = savedLocale === "en" ? "en" : "vi";
            var currentPath = window.location.pathname;
            var canTranslate =
              (currentPath.indexOf("/student/") === 0 &&
                currentPath.indexOf("/student/chatbot") !== 0) ||
              currentPath.indexOf("/lecturer/") === 0;
            document.documentElement.lang = selectedLocale;
            document.documentElement.dataset.internovaLocale = selectedLocale;
            if (canTranslate && selectedLocale === "en") {
              document.documentElement.classList.add("internova-translation-pending");
            }
          } catch (_) {}`}
        </Script>
      </body>
    </html>
  );
}

