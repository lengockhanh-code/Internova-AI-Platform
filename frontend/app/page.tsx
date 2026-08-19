"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BotMessageSquare,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  GraduationCap,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  UserRoundCheck,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

import styles from "./page.module.css";

const features = [
  {
    icon: BotMessageSquare,
    title: "Tư vấn học vụ bằng AI",
    description:
      "Tra cứu thông tin từ bộ tài liệu thực tập VinUni được đưa vào hệ thống, kèm nguồn tham khảo rõ ràng.",
    highlight: "RAG Assistant",
  },
  {
    icon: FileSearch,
    title: "CV - JD Matching",
    description:
      "Phân tích mức độ phù hợp giữa CV và mô tả công việc, đồng thời đề xuất nội dung cần cải thiện.",
    highlight: "Smart Matching",
  },
  {
    icon: FileText,
    title: "Quản lý báo cáo",
    description:
      "Tạo, theo dõi và nộp các loại báo cáo theo cấu hình của chương trình thực tập VinUni trong một không gian thống nhất.",
    highlight: "Report Center",
  },
  {
    icon: ClipboardCheck,
    title: "Checklist thông minh",
    description:
      "Theo dõi nhiệm vụ, mốc thời gian và yêu cầu hồ sơ được cấu hình cho từng đợt thực tập tại VinUni.",
    highlight: "Progress Tracking",
  },
  {
    icon: BriefcaseBusiness,
    title: "Hồ sơ thực tập tập trung",
    description:
      "Quản lý thông tin doanh nghiệp, mentor, giảng viên hướng dẫn, thời gian và tài liệu thực tập một cách trực quan.",
    highlight: "Internship Profile",
  },
  {
    icon: TrendingUp,
    title: "Theo dõi tiến độ",
    description:
      "Dashboard tổng quan giúp sinh viên chủ động nhận biết công việc, deadline và mức độ hoàn thành.",
    highlight: "Live Dashboard",
  },
];

const steps = [
  {
    number: "01",
    icon: UserRoundCheck,
    title: "Tạo hồ sơ",
    description:
      "Cập nhật thông tin cá nhân, doanh nghiệp và vị trí thực tập.",
  },
  {
    number: "02",
    icon: UploadCloud,
    title: "Tải CV và tài liệu",
    description:
      "Lưu trữ CV, đơn đăng ký, kế hoạch và các tài liệu cần thiết.",
  },
  {
    number: "03",
    icon: WandSparkles,
    title: "Nhận hỗ trợ từ AI",
    description:
      "Tra cứu quy định, phân tích CV và nhận gợi ý cá nhân hóa.",
  },
  {
    number: "04",
    icon: Target,
    title: "Hoàn thành kỳ thực tập",
    description:
      "Theo dõi tiến độ, nộp báo cáo và hoàn thiện mọi đầu việc.",
  },
];

const stats = [
  {
    value: "24/7",
    label: "Trợ lý AI sẵn sàng",
  },
  {
    value: "01",
    label: "Nền tảng tập trung",
  },
  {
    value: "100%",
    label: "Theo sát tiến độ",
  },
  {
    value: "< 3s",
    label: "Trải nghiệm phản hồi",
  },
];

const testimonials = [
  {
    content:
      "Internova giúp mình không còn bỏ sót deadline và dễ dàng tra cứu những quy định thực tập mà trước đây phải tìm trong rất nhiều tài liệu.",
    name: "Sinh viên VinUni",
    role: "Phản hồi minh hoạ",
    initials: "VU",
  },
  {
    content:
      "Tính năng CV - JD Matching cho mình thấy rõ điểm mạnh và những phần cần sửa trước khi ứng tuyển vào doanh nghiệp.",
    name: "Sinh viên VinUni",
    role: "Phản hồi minh hoạ",
    initials: "VU",
  },
  {
    content:
      "Dashboard rất trực quan. Mình có thể theo dõi hồ sơ, báo cáo và tiến độ thực tập trong cùng một hệ thống.",
    name: "Sinh viên VinUni",
    role: "Phản hồi minh hoạ",
    initials: "VU",
  },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("features");

  useEffect(() => {
    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -70px 0px",
      }
    );

    revealElements.forEach((element) => {
      element.classList.add(styles.reveal);
      revealObserver.observe(element);
    });

    const sectionIds = ["features", "ai", "workflow", "reviews"];
    const sectionElements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (visibleEntry?.target.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        threshold: [0.2, 0.35, 0.55],
        rootMargin: "-20% 0px -55% 0px",
      }
    );

    sectionElements.forEach((section) => sectionObserver.observe(section));

    return () => {
      revealObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  const handleNavClick = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string
  ) => {
    event.preventDefault();

    const target = document.getElementById(sectionId);

    if (!target) {
      return;
    }

    setActiveSection(sectionId);
    setMenuOpen(false);

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.history.replaceState(null, "", `#${sectionId}`);
  };

  return (
    <main className={styles.page}>
      <div className={styles.backgroundGrid} />

      <header className={styles.header}>
        <nav className={styles.navbar}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>
              <Image
                src="/internova.png"
                alt="Internova for VinUni logo"
                width={48}
                height={48}
                priority
              />
            </span>

            <span className={styles.logoText}>
              <strong>Internova</strong>
              <small>for VinUni students</small>
            </span>
          </Link>

          <div className={styles.desktopNav}>
            <a
              href="#features"
              className={activeSection === "features" ? styles.navActive : ""}
              onClick={(event) => handleNavClick(event, "features")}
            >
              Tính năng
            </a>
            <a
              href="#ai"
              className={activeSection === "ai" ? styles.navActive : ""}
              onClick={(event) => handleNavClick(event, "ai")}
            >
              Internship AI
            </a>
            <a
              href="#workflow"
              className={activeSection === "workflow" ? styles.navActive : ""}
              onClick={(event) => handleNavClick(event, "workflow")}
            >
              Quy trình
            </a>
            <a
              href="#reviews"
              className={activeSection === "reviews" ? styles.navActive : ""}
              onClick={(event) => handleNavClick(event, "reviews")}
            >
              Đánh giá
            </a>
          </div>

          <div className={styles.navActions}>
            <Link
              href="/auth/login"
              className={styles.loginLink}
            >
              Đăng nhập
            </Link>

            <Link
              href="/auth/register"
              className={styles.registerLink}
            >
              Đăng ký
              <ArrowRight size={16} />
            </Link>
          </div>

          <button
            type="button"
            className={styles.menuButton}
            aria-label="Mở menu"
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </nav>

        {menuOpen && (
          <div className={styles.mobileMenu}>
            <a
              href="#features"
              className={activeSection === "features" ? styles.mobileNavActive : ""}
              onClick={(event) => handleNavClick(event, "features")}
            >
              Tính năng
            </a>

            <a
              href="#ai"
              className={activeSection === "ai" ? styles.mobileNavActive : ""}
              onClick={(event) => handleNavClick(event, "ai")}
            >
              VinUni Internship AI
            </a>

            <a
              href="#workflow"
              className={activeSection === "workflow" ? styles.mobileNavActive : ""}
              onClick={(event) => handleNavClick(event, "workflow")}
            >
              Quy trình
            </a>

            <a
              href="#reviews"
              className={activeSection === "reviews" ? styles.mobileNavActive : ""}
              onClick={(event) => handleNavClick(event, "reviews")}
            >
              Đánh giá
            </a>

            <div className={styles.mobileActions}>
              <Link href="/auth/login">Đăng nhập</Link>
              <Link href="/auth/register">Đăng ký</Link>
            </div>
          </div>
        )}
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            Nền tảng quản lý thực tập dành cho sinh viên VinUni
          </div>

          <div className={styles.universityIdentity}>
            <span className={styles.universityMark}>V</span>
            <div>
              <strong>Internova for VinUni</strong>
              <small>Student Internship Support Platform</small>
            </div>
          </div>

          <h1>
            Quản lý kỳ thực tập
            <span> rõ ràng, tập trung và đúng tiến độ.</span>
          </h1>

          <p className={styles.heroDescription}>
            Internova tập trung hồ sơ, báo cáo, checklist, tiến độ và hỗ trợ tra cứu quy định thực tập trong một hệ thống thống nhất dành cho sinh viên VinUni.
          </p>

          <div className={styles.heroActions}>
            <Link
              href="/auth/register"
              className={styles.primaryButton}
            >
              Tạo tài khoản sinh viên
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.dashboardMockup}>
            <div className={styles.mockupTopbar}>
              <div className={styles.mockupLogo}>
                <Image
                  src="/internova.png"
                  alt="Internova for VinUni logo"
                  width={32}
                  height={32}
                />
                <span>Internova × VinUni</span>
              </div>

              <div className={styles.mockupUser}>
                <span />
                Hoàng
              </div>
            </div>

            <div className={styles.mockupContent}>
              <div className={styles.mockupWelcome}>
                <div>
                  <small>Chào buổi sáng</small>
                  <strong>Hành trình của bạn</strong>
                </div>

                <span className={styles.liveBadge}>
                  <i />
                  Đang hoạt động
                </span>
              </div>

              <div className={styles.mockupStats}>
                <div>
                  <span className={styles.miniIcon}>
                    <CheckCircle2 size={17} />
                  </span>
                  <small>Tiến độ</small>
                  <strong>75%</strong>
                </div>

                <div>
                  <span className={styles.miniIcon}>
                    <FileText size={17} />
                  </span>
                  <small>Báo cáo</small>
                  <strong>06</strong>
                </div>

                <div>
                  <span className={styles.miniIcon}>
                    <Target size={17} />
                  </span>
                  <small>Deadline</small>
                  <strong>03</strong>
                </div>
              </div>

              <div className={styles.mockupMainGrid}>
                <div className={styles.progressPanel}>
                  <div className={styles.panelTitle}>
                    <span>Tiến độ thực tập</span>
                    <strong>Tuần 6</strong>
                  </div>

                  <div className={styles.chartBars}>
                    <span style={{ height: "36%" }} />
                    <span style={{ height: "54%" }} />
                    <span style={{ height: "46%" }} />
                    <span style={{ height: "72%" }} />
                    <span style={{ height: "64%" }} />
                    <span style={{ height: "88%" }} />
                    <span style={{ height: "76%" }} />
                  </div>

                  <div className={styles.chartLabels}>
                    <span>T2</span>
                    <span>T3</span>
                    <span>T4</span>
                    <span>T5</span>
                    <span>T6</span>
                    <span>T7</span>
                    <span>CN</span>
                  </div>
                </div>

                <div className={styles.aiPanel}>
                  <span className={styles.aiPanelIcon}>
                    <Sparkles size={21} />
                  </span>

                  <strong>VinUni Internship AI</strong>

                  <p>
                    Tôi có thể hỗ trợ bạn tra cứu quy định
                    và chuẩn bị hồ sơ.
                  </p>

                  <button type="button">
                    Bắt đầu trò chuyện
                  </button>
                </div>
              </div>

              <div className={styles.taskPanel}>
                <div className={styles.panelTitle}>
                  <span>Nhiệm vụ gần đây</span>
                  <small>Xem tất cả</small>
                </div>

                <div className={styles.taskItem}>
                  <span className={styles.taskCheck}>
                    <Check size={14} />
                  </span>
                  <div>
                    <strong>Nộp báo cáo tuần 6</strong>
                    <small>Hoàn thành đúng hạn</small>
                  </div>
                  <span className={styles.doneBadge}>
                    Hoàn thành
                  </span>
                </div>

                <div className={styles.taskItem}>
                  <span className={styles.taskPending}>
                    <FileText size={14} />
                  </span>
                  <div>
                    <strong>Hoàn thiện hồ sơ thực tập</strong>
                    <small>Còn thiếu 1 tài liệu</small>
                  </div>
                  <span className={styles.pendingBadge}>
                    Đang làm
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.floatingCardOne}>
            <span>
              <Zap size={19} />
            </span>

            <div>
              <strong>AI sẵn sàng</strong>
              <small>Hỗ trợ bạn 24/7</small>
            </div>
          </div>

          <div className={styles.floatingCardTwo}>
            <span>
              <ShieldCheck size={19} />
            </span>

            <div>
              <strong>Dữ liệu đáng tin cậy</strong>
              <small>Dựa trên tài liệu chính thức</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.statsSection} data-reveal>
        <div className={styles.statsContainer}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className={styles.section} data-reveal>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>
            <Sparkles size={15} />
            Hệ sinh thái thực tập VinUni
          </span>

          <h2>
            Mọi công cụ bạn cần cho một kỳ thực tập
            <span> hiệu quả.</span>
          </h2>

          <p>
            Tập trung hồ sơ, checklist, báo cáo, quy trình và trợ lý AI trong một trải nghiệm thống nhất dành cho sinh viên VinUni.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map(
            ({
              icon: Icon,
              title,
              description,
              highlight,
            }) => (
              <article
                key={title}
                className={styles.featureCard}
                data-reveal
              >
                <div className={styles.featureCardTop}>
                  <span className={styles.featureIcon}>
                    <Icon size={25} strokeWidth={1.8} />
                  </span>

                  <span className={styles.featureTag}>
                    {highlight}
                  </span>
                </div>

                <h3>{title}</h3>
                <p>{description}</p>

                <span className={styles.featureLink}>
                  Tìm hiểu thêm
                  <ArrowRight size={16} />
                </span>
              </article>
            )
          )}
        </div>
      </section>

      <section id="ai" className={styles.aiSection} data-reveal>
        <div className={styles.aiShowcase}>
          <div className={styles.aiContent}>
            <span className={styles.sectionEyebrowDark}>
              <BotMessageSquare size={16} />
              VinUni Internship AI
            </span>

            <h2>
              Không chỉ là chatbot.
              <span> Đây là trợ lý thực tập cá nhân.</span>
            </h2>

            <p>
              Trợ lý AI truy xuất nội dung từ bộ tài liệu thực tập VinUni đã được quản trị viên phê duyệt, hiển thị nguồn tham khảo và thông báo rõ khi chưa đủ căn cứ trả lời.
            </p>

            <ul className={styles.aiBenefits}>
              <li>
                <CheckCircle2 size={19} />
                Tra cứu quy định và thủ tục thực tập
              </li>
              <li>
                <CheckCircle2 size={19} />
                Trả lời dựa trên tài liệu đáng tin cậy
              </li>
              <li>
                <CheckCircle2 size={19} />
                Gợi ý cải thiện CV theo từng công việc
              </li>
              <li>
                <CheckCircle2 size={19} />
                Hỗ trợ sinh viên mọi lúc, mọi nơi
              </li>
            </ul>

            <Link
              href="/auth/register"
              className={styles.aiButton}
            >
              Trải nghiệm VinUni Internship AI
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className={styles.aiChatPreview}>
            <div className={styles.chatPreviewHeader}>
              <div>
                <span className={styles.chatAvatar}>
                  <BotMessageSquare size={22} />
                </span>

                <div>
                  <strong>VinUni Internship AI</strong>
                  <small>
                    <i />
                    Đang trực tuyến
                  </small>
                </div>
              </div>

              <Sparkles size={20} />
            </div>

            <div className={styles.chatMessages}>
              <div className={styles.userMessage}>
                Quy trình đăng ký thực tập gồm những bước nào?
              </div>

              <div className={styles.botMessage}>
                <span>
                  <BotMessageSquare size={17} />
                </span>

                <div>
                  <p>
                    Quy trình đăng ký thực tập thường bao
                    gồm 4 bước chính:
                  </p>

                  <ol>
                    <li>Hoàn thiện hồ sơ sinh viên.</li>
                    <li>Đăng ký doanh nghiệp thực tập.</li>
                    <li>Nộp kế hoạch thực tập.</li>
                    <li>Chờ khoa xác nhận.</li>
                  </ol>

                  <small>
                    <BookOpenCheck size={14} />
                    Nguồn: Tài liệu thực tập VinUni trong hệ thống
                  </small>
                </div>
              </div>
            </div>

            <div className={styles.chatInput}>
              <span>Nhập câu hỏi của bạn...</span>
              <button type="button">
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className={styles.section} data-reveal>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>
            <Target size={15} />
            Quy trình đơn giản
          </span>

          <h2>
            Bắt đầu hành trình chỉ với
            <span> bốn bước.</span>
          </h2>

          <p>
            Luồng sử dụng được thiết kế ngắn gọn để sinh viên VinUni có thể bắt đầu nhanh, theo dõi đúng đầu việc và không bỏ lỡ các mốc quan trọng.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          {steps.map(
            ({
              number,
              icon: Icon,
              title,
              description,
            }) => (
              <article key={number} className={styles.stepCard} data-reveal>
                <span className={styles.stepNumber}>
                  {number}
                </span>

                <span className={styles.stepIcon}>
                  <Icon size={25} />
                </span>

                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            )
          )}
        </div>
      </section>

      <section id="reviews" className={styles.reviewSection} data-reveal>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>
            <MessageSquareText size={15} />
            Trải nghiệm người dùng
          </span>

          <h2>
            Được xây dựng để sinh viên
            <span> tự tin hơn.</span>
          </h2>
        </div>

        <div className={styles.reviewGrid}>
          {testimonials.map((testimonial, index) => (
            <article
              key={`${testimonial.name}-${index}`}
              className={styles.reviewCard}
              data-reveal
            >
              <div className={styles.reviewStars}>
                ★ ★ ★ ★ ★
              </div>

              <blockquote>
                “{testimonial.content}”
              </blockquote>

              <div className={styles.reviewUser}>
                <span>{testimonial.initials}</span>

                <div>
                  <strong>{testimonial.name}</strong>
                  <small>{testimonial.role}</small>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection} data-reveal>
        <div className={styles.ctaGlow} />

        <div className={styles.ctaContent}>
          <span>
            <GraduationCap size={28} />
          </span>

          <h2>Sẵn sàng chủ động hơn trong kỳ thực tập tại VinUni?</h2>

          <p>
            Đăng nhập bằng tài khoản được cấp để quản lý hồ sơ, báo cáo, checklist và nhận hỗ trợ AI trong cùng một nền tảng.
          </p>

          <div className={styles.ctaActions}>
            <Link
              href="/auth/register"
              className={styles.ctaPrimary}
            >
              Đăng ký sử dụng
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/auth/login"
              className={styles.ctaSecondary}
            >
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer} data-reveal>
        <div className={styles.footerGlow} />

        <div className={styles.footerContainer}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href="/" className={styles.footerLogo}>
                <span className={styles.footerLogoIcon}>
                  <Image
                    src="/internova.png"
                    alt="Internova for VinUni logo"
                    width={48}
                    height={48}
                  />
                </span>

                <span>
                  <strong>Internova</strong>
                  <small>Internship Support Platform</small>
                </span>
              </Link>

              <p>
                Nền tảng hỗ trợ hành trình thực tập của sinh viên VinUni, kết nối hồ sơ, tiến độ, báo cáo và trợ lý AI.
              </p>


              <p className={styles.projectNote}>
                Sản phẩm phục vụ dự án tại VinUni; nội dung quy định được quản trị theo tài liệu của từng chương trình.
              </p>
            </div>

            <div className={styles.footerNavigation}>
              <div className={styles.footerColumn}>
                <h3>Sản phẩm</h3>

                <a href="#features">Tính năng</a>
                <a href="#ai">VinUni Internship AI</a>
                <a href="#workflow">Quy trình</a>
                <a href="#reviews">Đánh giá</a>
              </div>

              <div className={styles.footerColumn}>
                <h3>Tài khoản</h3>

                <Link href="/auth/login">Đăng nhập</Link>
                <Link href="/auth/register">Đăng ký</Link>
                <Link href="student/dashboard">Dashboard</Link>
                <Link href="student/internship-profile">
                  Hồ sơ thực tập
                </Link>
              </div>

              <div className={styles.footerColumn}>
                <h3>Hỗ trợ</h3>

                <a href="#">Trung tâm trợ giúp</a>
                <a href="#">Điều khoản sử dụng</a>
                <a href="#">Chính sách bảo mật</a>
                <a href="#">Liên hệ</a>
              </div>
            </div>
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.footerBottom}>
            <p>© 2026 Internova for VinUni — Student Project.</p>

            <div className={styles.footerBottomLinks}>
              <a href="#">Quyền riêng tư</a>
              <a href="#">Điều khoản</a>
              <span>Built for VinUni students</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}