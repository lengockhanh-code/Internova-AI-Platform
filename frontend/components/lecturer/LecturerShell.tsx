"use client";

import {
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  lecturerFetch as fetch,
  signOutLecturer,
} from "@/lib/lecturerAuth";
import {
  fetchLecturerUnreadCount,
  subscribeLecturerUnreadCount,
} from "@/lib/lecturerNotifications";

import LecturerLanguageSwitcher from "./LecturerLanguageSwitcher";
import styles from "./LecturerShell.module.css";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

interface LecturerInfo {
  fullName: string;
  academicTitle: string | null;
  specialization: string | null;
}

interface DashboardResponse {
  lecturer?: Partial<LecturerInfo>;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
}

interface SearchItem extends NavItem {
  description: string;
  href: string;
  keywords: string;
}

const managementItems: NavItem[] = [
  {
    label: "Tổng quan",
    icon: LayoutDashboard,
    href: "/lecturer/dashboard",
  },
  {
    label: "Sinh viên của tôi",
    icon: UsersRound,
    href: "/lecturer/students",
  },
  {
    label: "Đợt thực tập",
    icon: CalendarDays,
    href: "/lecturer/internship-periods",
  },
  {
    label: "Hồ sơ đăng ký",
    icon: ClipboardCheck,
    href: "/lecturer/applications",
  },
  {
    label: "Nhật ký & Báo cáo",
    icon: FileText,
    href: "/lecturer/reports",
  },
  {
    label: "Đánh giá",
    icon: Star,
    href: "/lecturer/evaluations",
  },
  {
    label: "Nhắc nhở & Cảnh báo",
    icon: Bell,
    href: "/lecturer/reminders",
  },
];

const aiItems: NavItem[] = [
  {
    label: "Trợ lý AI",
    icon: Bot,
  },
];

const searchItems: SearchItem[] = [
  {
    label: "Tổng quan",
    description: "Xem số liệu và hoạt động hướng dẫn",
    href: "/lecturer/dashboard",
    icon: LayoutDashboard,
    keywords: "dashboard thống kê hoạt động",
  },
  {
    label: "Sinh viên của tôi",
    description: "Tìm sinh viên, doanh nghiệp và tiến độ",
    href: "/lecturer/students",
    icon: UsersRound,
    keywords: "sinh viên mã sinh viên lớp doanh nghiệp tiến độ",
  },
  {
    label: "Đợt thực tập",
    description: "Quản lý các kỳ và đợt thực tập",
    href: "/lecturer/internship-periods",
    icon: CalendarDays,
    keywords: "kỳ thời gian học kỳ",
  },
  {
    label: "Hồ sơ đăng ký",
    description: "Xem và duyệt hồ sơ thực tập",
    href: "/lecturer/applications",
    icon: ClipboardCheck,
    keywords: "đăng ký duyệt hồ sơ ứng tuyển",
  },
  {
    label: "Nhật ký & Báo cáo",
    description: "Tìm báo cáo và nội dung sinh viên đã nộp",
    href: "/lecturer/reports",
    icon: FileText,
    keywords: "nhật ký báo cáo tuần nộp chấm",
  },
  {
    label: "Đánh giá",
    description: "Chấm điểm và quản lý đánh giá thực tập",
    href: "/lecturer/evaluations",
    icon: Star,
    keywords: "đánh giá điểm chấm kết quả",
  },
  {
    label: "Nhắc nhở & Cảnh báo",
    description: "Theo dõi hạn và các trường hợp cần chú ý",
    href: "/lecturer/reminders",
    icon: Bell,
    keywords: "nhắc nhở cảnh báo hạn trễ rủi ro",
  },
  {
    label: "Thông báo",
    description: "Xem tất cả thông báo của bạn",
    href: "/lecturer/notifications",
    icon: Bell,
    keywords: "notification tin mới chưa đọc",
  },
  {
    label: "Hồ sơ & cài đặt",
    description: "Cập nhật thông tin, bảo mật và tùy chọn",
    href: "/lecturer/settings",
    icon: Settings,
    keywords: "cá nhân tài khoản mật khẩu bảo mật",
  },
];

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

function getInitials(fullName: string): string {
  const name = fullName.trim();

  if (!name) {
    return "GV";
  }

  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function SidebarSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <section className={styles.sidebarSection}>
      <p className={styles.sidebarLabel}>{title}</p>

      <div className={styles.navList}>
        {items.map((item) => {
          const Icon = item.icon;

          const active = item.href
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : false;

          return (
            <button
              className={`${styles.navItem} ${
                active ? styles.navItemActive : ""
              }`}
              key={item.label}
              onClick={() => {
                if (item.href) {
                  onNavigate(item.href);
                }
              }}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>

              {!item.href && (
                <ChevronDown
                  className={styles.itemChevron}
                  size={15}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function LecturerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const searchMenuRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lecturer, setLecturer] = useState<LecturerInfo>({
    fullName: "Giảng viên",
    academicTitle: null,
    specialization: null,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHeader() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/lecturers/dashboard`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as DashboardResponse;

        setLecturer({
          fullName:
            typeof data.lecturer?.fullName === "string"
              ? data.lecturer.fullName
              : "Giảng viên",
          academicTitle:
            typeof data.lecturer?.academicTitle === "string"
              ? data.lecturer.academicTitle
              : null,
          specialization:
            typeof data.lecturer?.specialization === "string"
              ? data.lecturer.specialization
              : null,
        });

      } catch {
        // Header vẫn render với fallback nếu backend tạm thời lỗi.
      }
    }

    void loadHeader();
    const refreshUnreadCount = () => {
      void fetchLecturerUnreadCount()
        .then(setUnreadCount)
        .catch(() => undefined);
    };
    refreshUnreadCount();
    const unsubscribe = subscribeLecturerUnreadCount(setUnreadCount);
    const interval = window.setInterval(refreshUnreadCount, 60_000);
    window.addEventListener("focus", refreshUnreadCount);

    return () => {
      controller.abort();
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnreadCount);
    };
  }, []);

  useEffect(() => {
    if (!accountOpen && !searchOpen) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }

      if (!searchMenuRef.current?.contains(event.target)) {
        setSearchOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setSearchOpen(false);

        if (searchOpen) {
          searchButtonRef.current?.focus();
        } else {
          accountButtonRef.current?.focus();
        }
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const displayName = useMemo(() => {
    if (lecturer.academicTitle) {
      return `${lecturer.academicTitle}. ${lecturer.fullName}`;
    }

    return lecturer.fullName;
  }, [lecturer]);

  const filteredSearchItems = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    if (!query) {
      return searchItems;
    }

    return searchItems.filter((item) =>
      normalizeSearchText(
        `${item.label} ${item.description} ${item.keywords}`,
      ).includes(query),
    );
  }, [searchQuery]);

  function navigate(href: string) {
    setMobileOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  }

  function logout() {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      return;
    }

    setAccountOpen(false);
    signOutLecturer();
  }

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${
          mobileOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Image
              alt="AI Internova logo"
              height={44}
              priority
              src="/intern.png"
              width={44}
            />
          </div>

          <div className={`${styles.brandText} notranslate`} translate="no">
            <strong>AI Internova</strong>
            <span>Hỗ trợ thực tập sinh viên</span>
          </div>

          <button
            aria-label="Đóng menu"
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <SidebarSection
          items={managementItems}
          onNavigate={navigate}
          pathname={pathname}
          title="QUẢN LÝ"
        />

        <SidebarSection
          items={aiItems}
          onNavigate={navigate}
          pathname={pathname}
          title="AI HỖ TRỢ"
        />

        <section className={styles.sidebarSection}>
          <p className={styles.sidebarLabel}>CÀI ĐẶT</p>

          <div className={styles.navList}>
            <button
              className={`${styles.navItem} ${
                pathname === "/lecturer/notifications" ? styles.navItemActive : ""
              }`}
              onClick={() => navigate("/lecturer/notifications")}
              type="button"
            >
              <Bell size={19} />
              <span>Thông báo</span>
            </button>

            <button
              className={`${styles.navItem} ${
                pathname === "/lecturer/settings" ? styles.navItemActive : ""
              }`}
              onClick={() => navigate("/lecturer/settings")}
              type="button"
            >
              <Settings size={19} />
              <span>Cài đặt cá nhân</span>
            </button>
          </div>
        </section>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Đóng menu"
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              aria-label="Mở menu"
              className={styles.menuButton}
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu size={22} />
            </button>

            <Menu className={styles.desktopMenu} size={22} />

            <strong className={styles.pageTitle}>{title}</strong>
          </div>

          <div className={styles.topbarRight}>
            <LecturerLanguageSwitcher />

            <div className={styles.searchMenu} ref={searchMenuRef}>
              <button
                aria-controls="lecturer-global-search"
                aria-expanded={searchOpen}
                aria-haspopup="dialog"
                aria-label="Tìm kiếm"
                className={`${styles.iconButton} ${
                  searchOpen ? styles.iconButtonActive : ""
                }`}
                onClick={() => {
                  setAccountOpen(false);
                  setSearchOpen((open) => !open);
                }}
                ref={searchButtonRef}
                type="button"
              >
                <Search size={20} />
              </button>

              {searchOpen && (
                <div
                  aria-label="Tìm kiếm nhanh"
                  className={styles.searchDropdown}
                  id="lecturer-global-search"
                  role="dialog"
                >
                  <div className={styles.searchField}>
                    <Search size={18} />
                    <input
                      aria-label="Nhập nội dung cần tìm"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                          return;
                        }

                        const query = searchQuery.trim();
                        if (query) {
                          navigate(
                            `/lecturer/students?q=${encodeURIComponent(query)}`,
                          );
                        } else if (filteredSearchItems[0]) {
                          navigate(filteredSearchItems[0].href);
                        }
                      }}
                      placeholder="Tìm sinh viên, báo cáo, hồ sơ..."
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                    />
                    {searchQuery && (
                      <button
                        aria-label="Xóa nội dung tìm kiếm"
                        onClick={() => {
                          setSearchQuery("");
                          searchInputRef.current?.focus();
                        }}
                        type="button"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <p className={styles.searchLabel}>
                    {searchQuery ? "KẾT QUẢ PHÙ HỢP" : "TRUY CẬP NHANH"}
                  </p>

                  <div className={styles.searchResults}>
                    {searchQuery.trim() && (
                      <>
                        <button
                          onClick={() => navigate(
                            `/lecturer/students?q=${encodeURIComponent(searchQuery.trim())}`,
                          )}
                          type="button"
                        >
                          <span className={styles.searchResultIcon}>
                            <UsersRound size={18} />
                          </span>
                          <span>
                            <strong>Tìm “{searchQuery.trim()}” trong sinh viên</strong>
                            <small>Theo tên, mã, lớp, ngành, doanh nghiệp hoặc vị trí</small>
                          </span>
                          <ChevronDown className={styles.searchResultArrow} size={16} />
                        </button>

                        <button
                          onClick={() => navigate(
                            `/lecturer/reports?q=${encodeURIComponent(searchQuery.trim())}`,
                          )}
                          type="button"
                        >
                          <span className={styles.searchResultIcon}>
                            <FileText size={18} />
                          </span>
                          <span>
                            <strong>Tìm “{searchQuery.trim()}” trong báo cáo</strong>
                            <small>Theo sinh viên, loại báo cáo hoặc doanh nghiệp</small>
                          </span>
                          <ChevronDown className={styles.searchResultArrow} size={16} />
                        </button>

                        <button
                          onClick={() => navigate(
                            `/lecturer/applications?q=${encodeURIComponent(searchQuery.trim())}`,
                          )}
                          type="button"
                        >
                          <span className={styles.searchResultIcon}>
                            <ClipboardCheck size={18} />
                          </span>
                          <span>
                            <strong>Tìm “{searchQuery.trim()}” trong hồ sơ</strong>
                            <small>Theo sinh viên, doanh nghiệp hoặc vị trí đăng ký</small>
                          </span>
                          <ChevronDown className={styles.searchResultArrow} size={16} />
                        </button>
                      </>
                    )}

                    {filteredSearchItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.href}
                          onClick={() => navigate(item.href)}
                          type="button"
                        >
                          <span className={styles.searchResultIcon}>
                            <Icon size={18} />
                          </span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                          <ChevronDown
                            className={styles.searchResultArrow}
                            size={16}
                          />
                        </button>
                      );
                    })}

                    {filteredSearchItems.length === 0 && !searchQuery.trim() && (
                      <div className={styles.searchEmpty}>
                        <Search size={24} />
                        <strong>Không tìm thấy kết quả</strong>
                        <span>Thử từ khóa khác hoặc chọn một chức năng gần nhất.</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.searchFooter}>
                    <span><kbd>Enter</kbd> mở kết quả đầu tiên</span>
                    <span><kbd>Esc</kbd> đóng</span>
                  </div>
                </div>
              )}
            </div>

            <button
              aria-label="Thông báo"
              className={styles.notificationButton}
              onClick={() => navigate("/lecturer/notifications")}
              type="button"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span>{Math.min(unreadCount, 99)}</span>
              )}
            </button>

            <div className={styles.accountMenu} ref={accountMenuRef}>
              <button
                aria-controls="lecturer-account-menu"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={`${styles.account} ${
                  accountOpen ? styles.accountOpen : ""
                }`}
                onClick={() => {
                  setSearchOpen(false);
                  setAccountOpen((open) => !open);
                }}
                ref={accountButtonRef}
                type="button"
              >
                <span className={styles.accountAvatar}>
                  {getInitials(lecturer.fullName)}
                </span>

                <span className={styles.accountText}>
                  <strong>{displayName}</strong>
                  <span>
                    {lecturer.specialization || "Giảng viên"}
                  </span>
                </span>

                <ChevronDown className={styles.accountChevron} size={17} />
              </button>

              {accountOpen && (
                <div
                  aria-label="Tùy chọn tài khoản"
                  className={styles.accountDropdown}
                  id="lecturer-account-menu"
                  role="menu"
                >
                  <div className={styles.accountDropdownHeader}>
                    <span className={styles.accountAvatar}>
                      {getInitials(lecturer.fullName)}
                    </span>
                    <span>
                      <strong>{displayName}</strong>
                      <small>{lecturer.specialization || "Giảng viên"}</small>
                    </span>
                  </div>

                  <div className={styles.accountDropdownItems}>
                    <button
                      onClick={() => navigate("/lecturer/settings")}
                      role="menuitem"
                      type="button"
                    >
                      <UserRound size={18} />
                      <span>
                        <strong>Hồ sơ &amp; cài đặt</strong>
                        <small>Cập nhật thông tin cá nhân</small>
                      </span>
                    </button>

                    <button
                      onClick={() => navigate("/lecturer/notifications")}
                      role="menuitem"
                      type="button"
                    >
                      <Bell size={18} />
                      <span>
                        <strong>Thông báo</strong>
                        <small>
                          {unreadCount > 0
                            ? `${unreadCount} thông báo chưa đọc`
                            : "Không có thông báo chưa đọc"}
                        </small>
                      </span>
                      {unreadCount > 0 && (
                        <b>{Math.min(unreadCount, 99)}</b>
                      )}
                    </button>
                  </div>

                  <div className={styles.accountDropdownFooter}>
                    <button
                      className={styles.logoutButton}
                      onClick={logout}
                      role="menuitem"
                      type="button"
                    >
                      <LogOut size={18} />
                      <span>
                        <strong>Đăng xuất</strong>
                        <small>Kết thúc phiên trên thiết bị này</small>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
