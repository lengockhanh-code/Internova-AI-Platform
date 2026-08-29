"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  CircleCheck,
  FileText,
  GraduationCap,
  Menu,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
  Target,
  UserRoundCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type NavItem = {
  label: string;
  id: string;
};

type SupportFeature = {
  index: string;
  title: string;
  description: string;
  items: string[];
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Tổng quan", id: "overview" },
  { label: "Tính năng", id: "features" },
  { label: "AI Assistant", id: "ai-assistant" },
  { label: "Quy trình", id: "journey" },
  { label: "Dành cho ai", id: "users" },
];

const supportFeatures: SupportFeature[] = [
  {
    index: "01",
    title: "AI Student Assistant",
    description: "Một điểm hỏi đáp thống nhất cho những câu hỏi sinh viên cần xử lý ngay.",
    items: ["Hỏi đáp quy định", "Tra cứu thông tin", "Hỗ trợ theo ngữ cảnh"],
    icon: MessageSquareText,
  },
  {
    index: "02",
    title: "Internship Support",
    description: "Theo dõi kỳ thực tập từ khâu chuẩn bị đến báo cáo hoàn thành.",
    items: ["Quản lý kỳ thực tập", "Theo dõi deadline", "Báo cáo tiến độ"],
    icon: BriefcaseBusiness,
  },
  {
    index: "03",
    title: "CV & Career Matching",
    description: "Biến CV và mô tả công việc thành tín hiệu rõ ràng để ra quyết định tốt hơn.",
    items: ["CV - JD matching", "Đánh giá mức độ phù hợp", "Đề xuất cải thiện CV"],
    icon: Target,
  },
  {
    index: "04",
    title: "Student Progress",
    description: "Giữ toàn bộ nhiệm vụ, milestone và việc cần làm ở đúng một nơi.",
    items: ["Checklist", "Nhiệm vụ", "Milestone & deadline"],
    icon: Radar,
  },
  {
    index: "05",
    title: "Documents",
    description: "Quản lý hồ sơ học tập và thực tập theo trạng thái thay vì theo thư mục rời rạc.",
    items: ["Quản lý tài liệu", "Hồ sơ", "Báo cáo"],
    icon: FileText,
  },
  {
    index: "06",
    title: "Smart Notifications",
    description: "Ưu tiên đúng thông tin cần hành động thay vì thêm một luồng thông báo gây nhiễu.",
    items: ["Nhắc deadline", "Cảnh báo việc còn thiếu"],
    icon: Bell,
  },
];

const journeySteps = [
  "Hoàn thiện hồ sơ",
  "Chuẩn bị CV",
  "Tìm cơ hội phù hợp",
  "Nhận hỗ trợ từ AI",
  "Theo dõi kỳ thực tập",
  "Hoàn thành báo cáo",
];

const trustItems = [
  ["Controlled knowledge sources", "Chỉ sử dụng các nguồn dữ liệu được quản trị và phê duyệt trong hệ thống."],
  ["Source attribution", "Mỗi câu trả lời quan trọng có thể đi kèm nguồn tham chiếu rõ ràng."],
  ["Role-based access", "Quyền truy cập được phân tách theo sinh viên, giảng viên và quản trị viên."],
  ["Student data protection", "Dữ liệu cá nhân được xử lý theo đúng ngữ cảnh và phạm vi cần thiết."],
  ["Auditability", "Các thay đổi và tương tác quan trọng có thể được theo dõi để phục vụ quản trị."],
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function InternovaLandingPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [introVideoStarted, setIntroVideoStarted] = useState(false);
  const [mainVideoReady, setMainVideoReady] = useState(false);

  const observedIds = useMemo(
    () => ["overview", "features", "ai-assistant", "journey", "dashboard", "users", "trust"],
    [],
  );

  useEffect(() => {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const id = visible.target.id;
        if (id === "dashboard" || id === "trust") return;
        setActiveSection(id);
      },
      {
        rootMargin: "-28% 0px -55% 0px",
        threshold: [0.08, 0.2, 0.35, 0.55],
      },
    );

    observedIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) sectionObserver.observe(element);
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    document.querySelectorAll(`.${styles.reveal}`).forEach((element) => {
      revealObserver.observe(element);
    });

    return () => {
      sectionObserver.disconnect();
      revealObserver.disconnect();
    };
  }, [observedIds]);

  useEffect(() => {
    let lastValue = window.scrollY > 24;
    setIsScrolled(lastValue);

    const onScroll = () => {
      const nextValue = window.scrollY > 24;
      if (nextValue === lastValue) return;
      lastValue = nextValue;
      setIsScrolled(nextValue);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <main className={styles.pageShell}>
      <link rel="preload" href="/videos/internova-poster.jpg" as="image" />
      <link rel="preload" href="/videos/internova-intro.mp4" as="video" type="video/mp4" />
      <div className={styles.videoLayer} aria-hidden="true">
        <video
          className={`${styles.backgroundVideo} ${styles.introVideo} ${mainVideoReady ? styles.videoHidden : ""}`}
          src="/videos/internova-intro.mp4"
          poster="/videos/internova-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setIntroVideoStarted(true)}
          onPlaying={() => setIntroVideoStarted(true)}
        />
        {introVideoStarted && (
          <video
            className={`${styles.backgroundVideo} ${styles.mainVideo} ${mainVideoReady ? styles.videoReady : ""}`}
            src="/videos/internova-scroll.mp4"
            poster="/videos/internova-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={() => setMainVideoReady(true)}
            onCanPlayThrough={() => setMainVideoReady(true)}
          />
        )}
        <div className={styles.videoOverlay} />
        <div className={styles.videoTexture} />
      </div>

      <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.headerInner}>
          <button className={styles.brand} type="button" onClick={() => scrollToSection("overview")}>
            <span className={styles.brandMark}>
              <Image src="/intern.png" alt="Internova" width={38} height={38} priority />
            </span>
            <span className={styles.brandTextGroup}>
              <strong>Internova</strong>
              <small>AI Student Support Platform</small>
            </span>
          </button>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.navLink} ${activeSection === item.id ? styles.navLinkActive : ""}`}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <a className={styles.loginLink} href="/auth/login">
              Đăng nhập
            </a>
            <a className={styles.loginLink} href="/auth/register">
              Đăng ký
            </a>
            <button
              className={styles.menuButton}
              type="button"
              aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        <div className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ""}`}>
          <div className={styles.mobileMenuInner}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.mobileNavLink} ${activeSection === item.id ? styles.mobileNavLinkActive : ""}`}
                onClick={() => {
                  scrollToSection(item.id);
                  setMobileOpen(false);
                }}
              >
                {item.label}
                <ChevronRight size={17} />
              </button>
            ))}
            <div className={styles.mobileMenuActions}>
              <a href="/auth/login" onClick={() => setMobileOpen(false)}>
                Đăng nhập
              </a>
              <a href="/auth/register" onClick={() => setMobileOpen(false)}>
                Đăng ký
              </a>
            </div>
          </div>
        </div>
      </header>

      <section id="overview" className={`${styles.heroSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={`${styles.eyebrow} ${styles.heroFadeOne}`}>
                <span className={styles.eyebrowLine} />
                AI-powered student support platform
              </div>

              <h1 className={`${styles.heroTitle} ${styles.heroFadeTwo}`}>
                Đồng hành cùng sinh viên
                <span> trong từng bước của hành trình đại học.</span>
              </h1>

              <p className={`${styles.heroLead} ${styles.heroFadeThree}`}>
                Internova kết nối thông tin, học tập, thực tập, hồ sơ và trợ lý AI trong một trải nghiệm thống nhất để
                sinh viên luôn biết mình cần làm gì tiếp theo.
              </p>


              <div className={`${styles.trustStrip} ${styles.heroFadeFive}`}>
                <div>
                  <ShieldCheck size={16} />
                  <span>Dữ liệu có kiểm soát</span>
                </div>
                <div>
                  <BookOpen size={16} />
                  <span>AI trả lời có căn cứ</span>
                </div>
                <div>
                  <CircleCheck size={16} />
                  <span>Hỗ trợ xuyên suốt</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="features" className={`${styles.contentSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.sectionIntro} ${styles.reveal}`}>
            <div className={styles.sectionKicker}>01 — STUDENT SUPPORT</div>
            <div className={styles.sectionIntroGrid}>
              <h2>Một nơi cho những việc sinh viên thực sự cần.</h2>
              <p>
                Thay vì chia nhỏ trải nghiệm thành nhiều cổng và công cụ rời rạc, Internova gom những tác vụ quan trọng
                vào một không gian thống nhất với ngữ cảnh rõ ràng.
              </p>
            </div>
          </div>

          <div className={styles.editorialFeatureGrid}>
            {supportFeatures.map((feature, featureIndex) => {
              const Icon = feature.icon;
              return (
                <article key={feature.index} className={`${styles.featureRow} ${styles.reveal}`}
                  style={{ "--item": featureIndex } as React.CSSProperties}>
                  <div className={styles.featureIndex}>{feature.index}</div>
                  <div className={styles.featureIcon}><Icon size={20} strokeWidth={1.65} /></div>
                  <div className={styles.featureMain}>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                  <ul className={styles.featureList}>
                    {feature.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="ai-assistant" className={`${styles.aiSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={styles.aiSectionGrid}>
            <div className={`${styles.aiCopy} ${styles.reveal}`}>
              <div className={styles.sectionKicker}>02 — INTERNOVA AI</div>
              <h2>
                AI biết câu trả lời
                <span> đến từ đâu.</span>
              </h2>
              <p>
                Câu trả lời dựa trên dữ liệu được quản lý, có nguồn tham chiếu và đúng ngữ cảnh sinh viên.
              </p>

              <div className={styles.aiPrinciples}>
                {[
                  [ShieldCheck, "Có căn cứ"],
                  [BookOpen, "Có nguồn"],
                  [UserRoundCheck, "Đúng ngữ cảnh"],
                ].map(([Icon, label], principleIndex) => {
                  const TypedIcon = Icon as LucideIcon;
                  return (
                    <div key={label as string} style={{ "--item": principleIndex } as React.CSSProperties}>
                      <TypedIcon size={17} strokeWidth={1.7} />
                      <span>{label as string}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="journey" className={`${styles.contentSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.sectionIntro} ${styles.reveal}`}>
            <div className={styles.sectionKicker}>03 — STUDENT JOURNEY</div>
            <div className={styles.sectionIntroGrid}>
              <h2>Từ chuẩn bị hồ sơ đến hoàn thành kỳ thực tập.</h2>
              <p>
                Một quy trình rõ ràng giúp sinh viên biết mình đang ở đâu, việc nào đang chờ và đâu là bước tiếp theo.
              </p>
            </div>
          </div>

          <div className={`${styles.timeline} ${styles.reveal}`}>
            <div className={styles.timelineTrack}>
              <div className={styles.timelineProgress} />
            </div>
            {journeySteps.map((step, index) => (
              <div key={step} className={styles.timelineStep} style={{ "--step": index } as React.CSSProperties}>
                <div className={styles.timelineNumber}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.timelineMarker} />
                <div className={styles.timelineContent}>
                  <h3>{step}</h3>
                  <p>
                    {index === 0 && "Hoàn thiện thông tin cá nhân, điều kiện và hồ sơ cần thiết."}
                    {index === 1 && "Chuẩn hóa CV theo mục tiêu nghề nghiệp và vị trí ứng tuyển."}
                    {index === 2 && "Đối chiếu hồ sơ với cơ hội phù hợp dựa trên kỹ năng và yêu cầu."}
                    {index === 3 && "Nhận hướng dẫn có căn cứ theo dữ liệu và bối cảnh của sinh viên."}
                    {index === 4 && "Theo dõi nhiệm vụ, mốc thời gian và báo cáo tiến độ thực tập."}
                    {index === 5 && "Hoàn tất báo cáo, tài liệu và các yêu cầu kết thúc kỳ thực tập."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="dashboard" className={`${styles.dashboardSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.dashboardIntro} ${styles.reveal}`}>
            <div>
              <div className={styles.sectionKicker}>04 — PERSONAL DASHBOARD</div>
              <h2>Một dashboard để biết chính xác việc gì cần làm tiếp theo.</h2>
            </div>
            <p>
              Tập trung các tín hiệu quan trọng — tiến độ, deadline, CV, tài liệu và tương tác AI — thay vì biến dashboard
              thành nơi chứa mọi dữ liệu có thể hiển thị.
            </p>
          </div>

          <div className={`${styles.fullDashboard} ${styles.reveal}`}>
            <div className={styles.dashboardToolbar}>
              <div>
                <Image src="/intern.png" alt="" width={30} height={30} />
                <span>Student overview</span>
              </div>
              <div className={styles.dashboardToolbarActions}>
                <button type="button"><Search size={15} /> Search</button>
                <button type="button"><Bell size={15} /></button>
                <span className={styles.dashboardAvatar}>VH</span>
              </div>
            </div>

            <div className={styles.dashboardHeaderRow}>
              <div>
                <span>FRIDAY · AUGUST 28</span>
                <h3>Welcome back, Student</h3>
                <p>Here is what needs your attention today.</p>
              </div>
              <div className={styles.dashboardHeaderMeta}>
                <span>Academic term</span>
                <strong>Fall 2026</strong>
              </div>
            </div>

            <div className={styles.dashboardStats}>
              <div className={styles.dashboardStatPrimary}>
                <div className={styles.statLabel}>Internship progress</div>
                <div className={styles.statValueRow}><strong>68%</strong><span>On track</span></div>
                <div className={styles.statProgress}><i style={{ width: "68%" }} /></div>
                <small>3 milestones remaining</small>
              </div>
              <div className={styles.dashboardStat}>
                <span>Tasks completed</span>
                <strong>12/16</strong>
                <small>75% completion</small>
              </div>
              <div className={styles.dashboardStat}>
                <span>Next deadline</span>
                <strong>Weekly report</strong>
                <small>Tomorrow · 17:00</small>
              </div>
              <div className={styles.dashboardStat}>
                <span>CV matching</span>
                <strong>84%</strong>
                <small>AI Product Intern</small>
              </div>
            </div>

            <div className={styles.dashboardMainGrid}>
              <div className={styles.dashboardTablePanel}>
                <div className={styles.tablePanelHeader}>
                  <div>
                    <span>UPCOMING TASKS</span>
                    <h4>Priority queue</h4>
                  </div>
                  <button type="button">View all</button>
                </div>
                <div className={styles.taskTable}>
                  <div className={styles.taskTableHead}>
                    <span>Task</span><span>Category</span><span>Due</span><span>Status</span>
                  </div>
                  {[
                    ["Submit weekly report", "Internship", "29 Aug", "High"],
                    ["Review CV suggestions", "Career", "31 Aug", "Review"],
                    ["Upload company confirmation", "Document", "02 Sep", "Pending"],
                    ["Supervisor check-in", "Internship", "04 Sep", "Scheduled"],
                  ].map((row, rowIndex) => (
                    <div className={styles.taskTableRow} key={row[0]} style={{ "--item": rowIndex } as React.CSSProperties}>
                      <strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className={styles.dashboardSidePanel}>
                <div className={styles.sidePanelBlock}>
                  <div className={styles.sidePanelTitle}>
                    <span>AI CONVERSATIONS</span>
                    <MessageSquareText size={16} />
                  </div>
                  <strong>18</strong>
                  <small>6 conversations this week</small>
                </div>

                <div className={styles.sidePanelBlock}>
                  <div className={styles.sidePanelTitle}>
                    <span>LATEST DOCUMENT</span>
                    <FileText size={16} />
                  </div>
                  <strong>Internship Agreement.pdf</strong>
                  <small>Verified · 24 Aug 2026</small>
                </div>

                <div className={styles.sidePanelBlock}>
                  <div className={styles.sidePanelTitle}>
                    <span>UPCOMING</span>
                    <Bell size={16} />
                  </div>
                  <strong>Supervisor review</strong>
                  <small>4 Sep · 10:00</small>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section id="users" className={`${styles.usersSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.sectionIntro} ${styles.reveal}`}>
            <div className={styles.sectionKicker}>05 — FOR EVERY ROLE</div>
            <div className={styles.sectionIntroGrid}>
              <h2>Một nền tảng, ba góc nhìn vận hành.</h2>
              <p>
                Cùng một hệ thống dữ liệu nhưng mỗi vai trò chỉ nhìn thấy đúng những gì họ cần để hành động.
              </p>
            </div>
          </div>

          <div className={styles.usersColumns}>
            <article className={`${styles.userColumn} ${styles.reveal}`} style={{ "--item": 0 } as React.CSSProperties}>
              <div className={styles.userColumnTop}>
                <span>01</span>
                <GraduationCap size={24} strokeWidth={1.5} />
              </div>
              <h3>Sinh viên</h3>
              <p>Quản lý hành trình cá nhân từ hồ sơ, CV, thực tập đến báo cáo và các mốc cần hoàn thành.</p>
              <ul>
                <li>Personal dashboard</li>
                <li>AI guidance</li>
                <li>Deadline & task tracking</li>
              </ul>
            </article>

            <article className={`${styles.userColumn} ${styles.reveal}`} style={{ "--item": 1 } as React.CSSProperties}>
              <div className={styles.userColumnTop}>
                <span>02</span>
                <UsersRound size={24} strokeWidth={1.5} />
              </div>
              <h3>Giảng viên</h3>
              <p>Theo dõi sinh viên, tiến độ thực tập, báo cáo và các trường hợp cần hỗ trợ sớm.</p>
              <ul>
                <li>Student monitoring</li>
                <li>Progress review</li>
                <li>Report oversight</li>
              </ul>
            </article>

            <article className={`${styles.userColumn} ${styles.reveal}`} style={{ "--item": 2 } as React.CSSProperties}>
              <div className={styles.userColumnTop}>
                <span>03</span>
                <ShieldCheck size={24} strokeWidth={1.5} />
              </div>
              <h3>Nhà trường / Admin</h3>
              <p>Quản trị tài liệu, tri thức, dữ liệu và theo dõi tiến độ tổng thể ở cấp hệ thống.</p>
              <ul>
                <li>Knowledge governance</li>
                <li>Role & access control</li>
                <li>Institution-wide overview</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="trust" className={`${styles.trustSection} ${styles.snapSection}`}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.trustHeading} ${styles.reveal}`}>
            <div className={styles.sectionKicker}>06 — TRUST BY DESIGN</div>
            <h2>AI đáng tin cậy bắt đầu từ dữ liệu đáng tin cậy.</h2>
          </div>

          <div className={styles.trustList}>
            {trustItems.map(([title, description], index) => (
              <div className={`${styles.trustRow} ${styles.reveal}`} key={title} style={{ "--item": index } as React.CSSProperties}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ShieldCheck size={19} strokeWidth={1.6} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCtaSection}>
        <div className={styles.sectionFrame}>
          <div className={`${styles.finalCtaInner} ${styles.reveal}`}>
            <div>
              <span>INTERNOVA AI PLATFORM</span>
              <h2>Một trải nghiệm tốt hơn cho hành trình sinh viên.</h2>
            </div>
            <a href="/auth/register">
              Đăng ký
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.sectionFrame}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Image src="/intern.png" alt="Internova" width={38} height={38} />
              <div>
                <strong>Internova</strong>
                <span>VinUni AI Student Support Platform</span>
              </div>
            </div>
            <div className={styles.footerLinks}>
              <a href="/auth/login">Login</a>
              <a href="/auth/register">Register</a>
              <a href="/privacy">Privacy</a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 Internova</span>
            <span>Built for a clearer student journey.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
