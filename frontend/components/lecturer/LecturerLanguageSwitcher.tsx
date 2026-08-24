"use client";

import { Languages } from "lucide-react";

import { useSettings } from "@/context/settings-provider";

import styles from "./LecturerLanguageSwitcher.module.css";

export default function LecturerLanguageSwitcher() {
  const { locale, setLocale } = useSettings();
  const label = locale === "vi" ? "Chọn ngôn ngữ" : "Select language";

  return (
    <div
      aria-label={label}
      className={`${styles.switcher} notranslate`}
      role="group"
      translate="no"
    >
      <Languages aria-hidden="true" className={styles.icon} size={16} />
      <button
        aria-pressed={locale === "vi"}
        className={locale === "vi" ? styles.active : ""}
        onClick={() => setLocale("vi")}
        title="Tiếng Việt"
        type="button"
      >
        VI
      </button>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? styles.active : ""}
        onClick={() => setLocale("en")}
        title="English"
        type="button"
      >
        EN
      </button>
    </div>
  );
}
