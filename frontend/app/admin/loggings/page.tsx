import Link from "next/link";

const cardStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 100%)",
  padding: "24px",
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "760px",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "32px",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
  color: "#0f172a",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "24px",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  borderRadius: "12px",
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#e2e8f0",
  color: "#0f172a",
};

export default function AdminLogsPage() {
  const langfuseUrl = process.env.NEXT_PUBLIC_LANGFUSE_URL || "https://cloud.langfuse.com";

  return (
    <main style={cardStyle}>
      <section style={panelStyle}>
        <p style={{ margin: 0, color: "#475569", fontSize: "14px", fontWeight: 700 }}>
          Admin / AI Monitoring
        </p>
        <h1 style={{ margin: "10px 0 12px", fontSize: "32px", lineHeight: 1.15 }}>
          AI Monitoring & Logs
        </h1>
        <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
          Trang theo doi log AI da san sang. Neu ban dang dung Langfuse, bam nut ben duoi
          de mo dashboard. Trang nay duoc tao de sua loi Not Found trong khu vuc admin.
        </p>

        <div style={buttonRowStyle}>
          <a
            href={langfuseUrl}
            target="_blank"
            rel="noreferrer"
            style={primaryButtonStyle}
          >
            Mo Langfuse Dashboard
          </a>
          <Link href="/admin" style={secondaryButtonStyle}>
            Ve Admin
          </Link>
          <Link href="/" style={secondaryButtonStyle}>
            Ve Trang Chu
          </Link>
        </div>
      </section>
    </main>
  );
}
