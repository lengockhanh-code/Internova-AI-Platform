export type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "LATE"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED";

export type ReportSubmissionStatus =
  | "UPCOMING"
  | "NOT_SUBMITTED"
  | "ON_TIME"
  | "LATE";

export type ReportType = "WEEKLY" | "MIDTERM" | "FINAL" | "REFLECTION";

export interface LecturerInfo {
  id: number | null;
  fullName: string;
  avatarUrl: string | null;
  academicTitle: string | null;
  lecturerCode: string | null;
  faculty: string | null;
  specialization: string | null;
}

export interface LecturerStats {
  totalStudents: number;
  pendingApplications: number;
  pendingReports: number;
  openWarnings: number;
  averageScore: number;
  reportsDueToDate: number;
  onTimeReports: number;
  lateReports: number;
  notSubmittedReports: number;
}

export interface InternshipProgress {
  total: number;
  notStarted: number;
  inProgress: number;
  paused: number;
  completed: number;
}

export interface ReportProgressSummary {
  requiredToDate: number;
  submittedToDate: number;
  onTime: number;
  late: number;
  notSubmitted: number;
  upcoming: number;
}

export interface ScoreDistributionItem {
  label: string;
  count: number;
  percentage: number;
}

export interface AtRiskStudent {
  studentId: number;
  internshipId: number;
  studentName: string;
  studentCode: string | null;
  progressPercentage: number;
  reportProgressPercentage: number;
  averageScore: number;
  warningCount: number;
  riskLevel: "HIGH" | "MEDIUM";
}

export interface LecturerAnalytics {
  completionRate: number;
  averageInternshipProgress: number;
  reportSubmissionRate: number;
  onTimeRate: number;
  studentsAtRisk: number;
  studentsWithScores: number;
  scoreDistribution: ScoreDistributionItem[];
  riskStudents: AtRiskStudent[];
}

export interface LatestReport {
  id: number;
  studentId: number | null;
  internshipId: number | null;
  studentName: string;
  studentCode: string | null;
  avatarUrl: string | null;
  weekNumber: number | null;
  reportType: ReportType;
  status: ReportStatus;
  submissionStatus: ReportSubmissionStatus | null;
  submittedAt: string | null;
  dueAt: string | null;
  lecturerScore: number | null;
  lecturerFeedback: string | null;
}

export interface LatestRequiredReport {
  scheduleId: number;
  reportId: number | null;
  weekNumber: number;
  title: string | null;
  dueAt: string;
  submittedAt: string | null;
  submissionStatus: ReportSubmissionStatus;
  reviewStatus: ReportStatus | null;
  lecturerScore: number | null;
}

export interface LecturerStudent {
  studentId: number;
  internshipId: number;
  studentName: string;
  studentCode: string | null;
  className: string | null;
  major: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  positionTitle: string | null;
  progressPercentage: number;
  reportProgressPercentage: number;
  reportsSubmitted: number;
  reportsRequiredToDate: number;
  averageScore: number;
  warningCount: number;
  status: InternshipStatus;
  latestRequiredReport: LatestRequiredReport | null;
}

export interface UpcomingDeadline {
  id: number;
  title: string;
  description: string | null;
  deadlineType: string;
  dueAt: string;
}

export interface LecturerDashboardData {
  lecturer: LecturerInfo;
  stats: LecturerStats;
  progress: InternshipProgress;
  reportProgress: ReportProgressSummary;
  analytics: LecturerAnalytics;
  latestReports: LatestReport[];
  students: LecturerStudent[];
  upcomingDeadlines: UpcomingDeadline[];
}
