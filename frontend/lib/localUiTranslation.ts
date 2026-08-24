export type UiLocale = "vi" | "en";

const VI_TO_EN: Record<string, string> = {
  // Student checklist page. Keep both complete sentences and JSX fragments:
  // React can render wrapped lines as separate text nodes.
  "Checklist thực tập": "Internship Checklist",
  "Theo dõi các nhiệm vụ, deadline và tiến độ trong suốt kỳ thực tập.":
    "Track tasks, deadlines, and progress throughout your internship.",
  "Theo dõi các": "Track all",
  "nhiệm vụ,": "tasks,",
  "deadline và": "deadlines, and",
  "tiến độ trong": "progress throughout",
  "suốt kỳ thực": "your internship",
  "Tổng công việc": "Total tasks",
  "Trong toàn bộ kỳ thực tập": "Across the entire internship",
  "Công việc đã hoàn tất": "Tasks completed",
  "Cần tiếp tục xử lý": "Tasks requiring attention",
  "Tiến độ chung": "Overall progress",
  "Mức độ hoàn thành": "Completion rate",
  "Thêm công việc": "Add task",
  "Bộ lọc": "Filters",
  "Đang thực hiện": "In progress",
  "Đã hoàn thành": "Completed",
  "Sắp xếp theo deadline": "Sort by deadline",
  "Sắp xếp theo": "Sort by",
  "Chưa có công việc": "No tasks yet",
  "Không có công việc phù hợp với bộ lọc hiện tại.":
    "No tasks match the current filters.",
  "Không có": "No",
  "phù hợp với": "match",
  "bộ lọc hiện": "the current filters",
  "Chuẩn bị hồ sơ": "Profile preparation",
  "Hoàn thiện các tài liệu cần thiết trước khi thực tập":
    "Complete the required documents before starting your internship",
  "Công việc trong tuần": "Weekly tasks",
  "Theo dõi tiến độ và các đầu việc đang thực hiện":
    "Track progress and tasks currently in progress",
  "Hoàn tất kỳ thực tập": "Internship completion",
  "Các đầu việc cần hoàn thành trước khi kết thúc kỳ":
    "Tasks to complete before the internship ends",
  "Ưu tiên cao": "High priority",
  "Ưu tiên vừa": "Medium priority",
  "Ưu tiên thấp": "Low priority",
  "Không có mô tả.": "No description.",
  "Chưa có deadline": "No deadline",
  "Đánh dấu": "Mark",
  "Thao tác với": "Actions for",
  "Tổng quan tiến độ": "Progress overview",
  "Đã hoàn": "Completed",
  "Đang thực": "In progress",
  "Chưa bắt": "Not started",
  "công việc": "tasks",
  "Deadline gần nhất": "Nearest deadline",
  "Hôm nay": "Today",
  "Không có deadline sắp tới.": "No upcoming deadlines.",
  "Không có deadline": "No upcoming deadline",
  "Tạo nhiệm vụ mới cho kỳ thực tập.":
    "Create a new task for your internship.",
  "Tạo nhiệm vụ": "Create a task",
  "mới cho kỳ": "for your",
  "Tên công việc": "Task name",
  "Ví dụ: Nộp báo cáo tuần 7": "Example: Submit week 7 report",
  "Mô tả công việc...": "Describe the task...",
  "Mô tả": "Description",
  "Nhóm": "Category",
  "Chuẩn bị": "Preparation",
  "Hoàn tất": "Completion",
  "Ưu tiên": "Priority",
  "Cao": "High",
  "Vừa": "Medium",
  "Thấp": "Low",
  "Đang tạo...": "Creating...",
  "Đang tải checklist...": "Loading checklist...",
  "Không thể tải checklist.": "Unable to load the checklist.",
  "Không thể tải checklist": "Unable to load the checklist",
  "Không thể cập nhật công việc.": "Unable to update the task.",
  "Không thể thêm công việc.": "Unable to add the task.",
  "Chức năng này chỉ dành cho sinh viên.":
    "This feature is available to students only.",
  "Sinh viên chưa có kỳ thực tập.":
    "The student does not have an internship period yet.",
  "Không tìm thấy công việc.": "Task not found.",
  // Default checklist data returned by the API/database.
  "Cập nhật CV": "Update CV",
  "Cập nhật CV trước kỳ thực tập.":
    "Update your CV before the internship.",
  "Nộp xác nhận thực tập": "Submit internship confirmation",
  "Nộp xác nhận từ doanh nghiệp.":
    "Submit confirmation from the company.",
  "Hoàn thành kế hoạch thực tập": "Complete the internship plan",
  "Gửi kế hoạch cho giảng viên.": "Send the plan to your lecturer.",
  "Theo dõi báo cáo trong quá trình thực tập, Mid-term Checkpoint, Final Report và Student Reflection.":
    "Track internship reports, Mid-term Checkpoints, Final Reports, and Student Reflections.",
  "Theo dõi báo cáo trong": "Track reports during",
  "quá trình thực tập,": "the internship,",
  "Final Report và": "Final Report and",
  "Mid-term Checkpoint dùng để theo dõi tiến độ. Final Report cần Letter of Completion. Student Reflection dùng để phản ánh learning outcomes và trải nghiệm thực tập.":
    "Use the Mid-term Checkpoint to track progress. The Final Report requires a Letter of Completion. Use the Student Reflection to reflect on learning outcomes and internship experience.",
  "Mid-term Checkpoint dùng": "Use the Mid-term Checkpoint",
  "để theo dõi tiến độ.": "to track progress.",
  "Final Report cần Letter": "The Final Report requires a Letter",
  "Student Reflection dùng": "Use the Student Reflection",
  "để phản ánh learning": "to reflect on learning",
  "outcomes và trải nghiệm": "outcomes and",
  "trải nghiệm thực tập.": "internship experience.",
  "Báo cáo thuộc kỳ thực tập của tài khoản đang đăng nhập.":
    "Reports from the internship period of the current account.",
  "Báo cáo thuộc kỳ": "Reports from the internship",
  "thực tập của tài": "period of the current",
  "khoản đang đăng": "signed-in account",
  "Báo cáo được lưu dưới dạng bản nháp cho tới khi bạn chủ động nộp.":
    "The report remains a draft until you submit it.",
  "Báo cáo được lưu dưới": "The report remains",
  "dạng bản nháp cho tới khi": "a draft until",
  "bạn chủ động nộp.": "you submit it.",
  "Quản lý thông tin cá nhân, đơn vị thực tập và các tài liệu liên quan.":
    "Manage personal information, internship organization, and related documents.",
  "Quản lý thông tin cá": "Manage personal information,",
  "nhân, đơn vị thực tập": "internship organization,",
  "và các tài liệu liên": "and related documents.",
  "Hồ sơ thực tập của bạn đã hoàn thiện.":
    "Your internship profile is complete.",
  "Các tỷ lệ được tính từ dữ liệu hiện tại":
    "Rates are calculated from current data",
  "Đây là tổng quan hoạt động hướng dẫn thực tập của bạn.":
    "This is an overview of your internship supervision activities.",
  "Đây là tổng quan hoạt": "This is an overview of",
  "động hướng dẫn thực tập": "your internship supervision",
  "của bạn.": "activities.",
  "Tất cả sinh viên đang theo đúng tiến độ.":
    "All students are currently on schedule.",
  "Giảng viên chưa được phân công sinh viên.":
    "No students have been assigned to this lecturer.",
  "Chưa có thời hạn sắp tới trong cơ sở dữ liệu.":
    "There are no upcoming deadlines in the database.",
  "Chưa có thời hạn sắp": "There are no upcoming",
  "tới trong cơ sở dữ": "deadlines in the",
  "liệu.": "database.",
  "Chưa có báo cáo nào trong cơ sở dữ liệu.":
    "There are no reports in the database.",
  "Bạn cần có kỳ thực tập trước khi tạo báo cáo.":
    "You need an internship period before creating a report.",
  "Tạo báo cáo mới để bắt đầu.":
    "Create a new report to get started.",
  "Faculty Mentor yêu cầu chỉnh sửa báo cáo.":
    "The Faculty Mentor requested report revisions.",
  "Final Report cần có Letter of Completion. Bạn chắc chắn muốn nộp?":
    "The Final Report requires a Letter of Completion. Do you want to submit it?",
  "Mô tả công việc trong tuần, kết quả đạt được, khó khăn, bài học và kế hoạch tiếp theo...":
    "Describe this week's work, results, challenges, lessons learned, and next steps...",
  "Mô tả tiến độ internship, công việc đã hoàn thành, kết quả hiện tại, khó khăn, kỹ năng đã học và kế hoạch cho giai đoạn tiếp theo...":
    "Describe internship progress, completed work, current results, challenges, skills learned, and plans for the next phase...",
  "Tổng kết internship: mục tiêu, công việc đã thực hiện, kết quả, kỹ năng/kiến thức học được, khó khăn và bài học...":
    "Summarize the internship: objectives, completed work, results, acquired skills and knowledge, challenges, and lessons learned...",
  "Phản ánh learning outcomes, điều học được, sự phát triển cá nhân, nghề nghiệp và những điều bạn sẽ làm khác trong tương lai...":
    "Reflect on learning outcomes, lessons learned, personal and professional growth, and what you would do differently in the future...",
  "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.":
    "Your session has expired. Please sign in again.",
  "Chỉ được tải PDF, DOC hoặc DOCX.":
    "Only PDF, DOC, or DOCX files are allowed.",
  "File không được vượt quá 10MB.":
    "The file must not exceed 10 MB.",
  "Tiêu đề không được để trống.":
    "The title is required.",
  "Báo cáo tuần cần nhập số tuần.":
    "A week number is required for a weekly report.",
  "Bạn chắc chắn muốn xóa": "Are you sure you want to delete",
  "Bạn chắc chắn muốn nộp lại báo cáo?":
    "Are you sure you want to resubmit this report?",
  "Bạn chắc chắn muốn nộp báo cáo?":
    "Are you sure you want to submit this report?",
  "Không thể tải hồ sơ thực tập.":
    "Unable to load the internship profile.",
  "Không thể tải dữ liệu.": "Unable to load data.",
  "Không thể tải báo cáo.": "Unable to load reports.",
  "Không thể lưu báo cáo.": "Unable to save the report.",
  "Không thể xóa báo cáo.": "Unable to delete the report.",
  "Không thể nộp báo cáo.": "Unable to submit the report.",
  "Không thể mở tài liệu.": "Unable to open the document.",
  "Không thể tải tài liệu.": "Unable to upload the document.",
  "Không thể xóa tài liệu.": "Unable to delete the document.",
  "Không thể tải file.": "Unable to download the file.",
  "Không thể mở file.": "Unable to open the file.",
  "Upload file thất bại.": "File upload failed.",
  "Có lỗi xảy ra.": "An error occurred.",
  "Đang tải dữ liệu từ": "Loading data from",
  "Không thể hiển thị": "Unable to display",
  "Không nhận được dữ liệu.": "No data was received.",
  "Kiểm tra FastAPI tại": "Check FastAPI at",
  "và xem log terminal": "and review the terminal logs",
  "Quy trình báo cáo thực tập": "Internship reporting process",
  "Báo cáo thực tập": "Internship Reports",
  "Tổng báo cáo": "Total reports",
  "Trong kỳ thực tập": "During the internship",
  "Đã gửi Faculty Mentor": "Sent to Faculty Mentor",
  "Theo các báo cáo đã tạo": "Based on created reports",
  "Danh sách báo cáo": "Report list",
  "Tiến độ báo cáo": "Report progress",
  "Deadline tiếp theo": "Next deadline",
  "Chưa có deadline sắp tới.": "No upcoming deadlines.",
  "Chưa có kỳ thực tập": "No internship period",
  "Chưa có báo cáo": "No reports yet",
  "Chưa tải lên": "Not uploaded",
  "Tạo báo cáo mới": "Create a new report",
  "Chỉnh sửa báo cáo": "Edit report",
  "Tạo bản nháp": "Create draft",
  "Lưu thay đổi": "Save changes",
  "Đang lưu...": "Saving...",
  "Loại báo cáo": "Report type",
  "Báo cáo tuần": "Weekly report",
  "Báo cáo kết thúc": "Final report",
  "Nội dung báo cáo": "Report content",
  "(nếu kỳ yêu cầu)": "(if required by the internship period)",
  "Phản hồi Faculty Mentor": "Faculty Mentor feedback",
  "Điểm đánh giá": "Evaluation score",
  "Chưa có phản hồi.": "No feedback yet.",
  "Tải Letter of Completion": "Download Letter of Completion",
  "Xem phản hồi Faculty Mentor": "View Faculty Mentor feedback",
  "Xóa bản nháp": "Delete draft",
  "Tải file": "Download file",
  "Nộp lại": "Resubmit",
  "Nộp báo cáo": "Submit report",
  "Tạo báo cáo": "Create report",
  "Bản nháp": "Draft",
  "Đã nộp": "Submitted",
  "Nộp trễ": "Submitted late",
  "Nộp muộn": "Submitted late",
  "Đang xem xét": "Under review",
  "Cần chỉnh sửa": "Revision required",
  "Đã duyệt": "Approved",
  "Chờ phản hồi": "Awaiting feedback",
  "Ngày nộp:": "Submitted:",
  "Hạn:": "Due:",
  "Tiêu đề": "Title",
  "Ví dụ:": "Example:",
  "Tất cả": "All",
  "Tuần": "Week",
  "Hủy": "Cancel",
  "Đóng": "Close",
  "Chỉnh sửa": "Edit",
  "Thử lại": "Try again",
  "Đang tải báo cáo...": "Loading reports...",
  "Hồ sơ thực tập": "Internship Profile",
  // Document titles returned dynamically by the internship-profile API.
  "CV cá nhân": "Personal CV",
  "Đơn đăng ký thực tập": "Internship Application Form",
  "Giấy xác nhận thực tập": "Internship Confirmation Letter",
  "Kế hoạch thực tập": "Internship Plan",
  "Thông tin thực tập": "Internship information",
  "Thông tin": "Information",
  "Tài liệu hồ sơ": "Profile documents",
  "Hỗ trợ PDF, DOC, DOCX. Tối đa 10MB mỗi file.":
    "PDF, DOC, and DOCX are supported. Maximum 10 MB per file.",
  "Hỗ trợ PDF, DOC,": "PDF, DOC, and DOCX",
  "DOCX. Tối đa 10MB": "are supported. Maximum 10 MB",
  "mỗi file.": "per file.",
  "Mức độ hoàn thiện": "Completion level",
  "Mức độ hoàn": "Completion",
  "thiện": "level",
  "Hoàn thiện": "Complete",
  "Đang tải hồ sơ thực tập...": "Loading internship profile...",
  "Không thể tải hồ sơ": "Unable to load profile",
  "Vị trí thực tập": "Internship position",
  "Địa điểm": "Location",
  "Thời gian": "Duration",
  "Công ty": "Company",
  "Chưa cập nhật": "Not updated",
  "Chưa thực tập": "Not started",
  "Thay tệp": "Replace file",
  "Tải lên": "Upload",
  "Đang tải...": "Uploading...",
  "Sinh viên đang hướng dẫn": "Supervised students",
  "Xem danh sách": "View list",
  "Hồ sơ chờ duyệt": "Pending applications",
  "Xem và xử lý": "Review and process",
  "Báo cáo chờ chấm": "Reports awaiting review",
  "Xem chi tiết": "View details",
  "Cảnh báo": "Warnings",
  "Xem cảnh báo": "View warnings",
  "Điểm TB sinh viên": "Average student score",
  "Thang điểm 10": "10-point scale",
  "Hiệu quả hướng dẫn": "Supervision performance",
  "Hoàn thành thực tập": "Internships completed",
  "Tiến độ thực tập trung bình": "Average internship progress",
  "Theo tiến độ của từng sinh viên": "Based on each student's progress",
  "Tỷ lệ nộp báo cáo": "Report submission rate",
  "Nộp báo cáo đúng hạn": "On-time report submission",
  "Phân bố điểm sinh viên": "Student score distribution",
  "Sinh viên cần chú ý": "Students requiring attention",
  "Chưa có sinh viên rủi ro": "No at-risk students",
  "Xem tất cả": "View all",
  "Tiến độ thực tập của sinh viên": "Student internship progress",
  "Kỳ thực tập hiện tại": "Current internship period",
  "Tổng số": "Total",
  "Chưa bắt đầu": "Not started",
  "Đang thực tập": "In progress",
  "Tài liệu": "Documents",
  "Tạm dừng": "Paused",
  "Hoàn thành": "Completed",
  "Báo cáo mới nhất": "Latest reports",
  "Lịch nhắc nhở": "Reminder calendar",
  "Tháng trước": "Previous month",
  "Tháng sau": "Next month",
  "Sự kiện sắp tới": "Upcoming events",
  "Danh sách sinh viên đang hướng dẫn": "Supervised student list",
  "Sinh viên": "Student",
  "Mã SV": "Student ID",
  "Doanh nghiệp": "Company",
  "Vị trí": "Position",
  "Điểm TB": "Average score",
  "Trạng thái": "Status",
  "Tổng quan": "Overview",
  "Sinh viên của tôi": "My students",
  "Đợt thực tập": "Internship periods",
  "Hồ sơ đăng ký": "Applications",
  "Nhật ký & Báo cáo": "Logs & Reports",
  "Đánh giá": "Evaluations",
  "Nhắc nhở & Cảnh báo": "Reminders & Warnings",
  "Trao đổi & Góp ý": "Messages & Feedback",
  "Trợ lý AI": "AI Assistant",
  "QUẢN LÝ": "MANAGEMENT",
  "AI HỖ TRỢ": "AI SUPPORT",
  "CÀI ĐẶT": "SETTINGS",
  "Xin chào,": "Hello,",
  "Cài đặt cá nhân": "Personal settings",
  "Thông báo": "Notifications",
  "Thu gọn": "Collapse",
  "Tìm kiếm": "Search",
  "Mở menu": "Open menu",
  "Đóng menu": "Close menu",
  "Tiến độ": "Progress",
};

const STUDENT_PORTAL_VI_TO_EN: Record<string, string> = {
  // Internship registration
  "Đăng ký học phần thực tập": "Internship Course Registration",
  "Khai báo thông tin doanh nghiệp, vị trí, mentor và thời gian thực tập.":
    "Provide the company, position, mentor, and internship dates.",
  "Thông tin được lấy từ tài khoản sinh viên đang đăng nhập.":
    "This information is retrieved from the signed-in student account.",
  "Thông tin sinh viên được lấy trực tiếp từ hệ thống.":
    "Student information is retrieved directly from the system.",
  "Khai báo đơn vị tiếp nhận sinh viên thực tập.":
    "Provide the organization hosting your internship.",
  "Khai báo vị trí, hình thức và thời gian làm việc.":
    "Provide the position, work arrangement, and internship dates.",
  "Thông tin người trực tiếp hướng dẫn.":
    "Information about your direct supervisor.",
  "Hãy mô tả nơi thực tập, vị trí, thời gian và mentor.":
    "Describe your internship organization, position, dates, and mentor.",
  "Xem lại toàn bộ thông tin trước khi gửi.":
    "Review all information before submitting.",
  "Gửi hồ sơ để giảng viên kiểm tra.":
    "Submit the application for lecturer review.",
  "Nhận kết quả hoặc yêu cầu chỉnh sửa.":
    "Receive the result or a revision request.",
  "Trợ lý điền hồ sơ thực tập": "Internship Application Assistant",
  "Chức năng AI Extract chưa được nối endpoint backend. Form sẽ không tự sinh dữ liệu giả.":
    "AI Extract is not connected to a backend endpoint yet. The form will not generate mock data.",
  "Tải JD lên hệ thống": "Upload the job description",
  "Phân tích và áp dụng": "Analyze and apply",
  "Đang phân tích...": "Analyzing...",
  "Thông tin cá nhân": "Personal information",
  "Thông tin sinh viên": "Student information",
  "Họ và tên": "Full name",
  "Họ tên": "Full name",
  "Mã số sinh viên": "Student ID",
  "Ngành học": "Major",
  "Công nghệ thông tin": "Information Technology",
  "Khóa": "Cohort",
  "Số điện thoại": "Phone number",
  "Thông tin công ty": "Company information",
  "Thông tin doanh nghiệp": "Company information",
  "Tên công ty": "Company name",
  "Tên doanh nghiệp": "Company name",
  "Ví dụ: FPT Software": "Example: FPT Software",
  "Lĩnh vực hoạt động": "Industry",
  "Lĩnh vực": "Industry",
  "Địa chỉ doanh nghiệp": "Company address",
  "Địa chỉ làm việc": "Work location",
  "Địa chỉ": "Address",
  "Thông tin thực tập": "Internship information",
  "Vị trí và thời gian": "Position and dates",
  "Vị trí thực tập": "Internship position",
  "Hình thức làm việc": "Work arrangement",
  "Hình thức": "Work arrangement",
  "Tại văn phòng": "On-site",
  "Từ xa": "Remote",
  "Kết hợp": "Hybrid",
  "Ngày bắt đầu": "Start date",
  "Ngày kết thúc": "End date",
  "Vui lòng nhập thời gian thực tập.": "Please enter the internship dates.",
  "Ngày kết thúc phải sau ngày bắt đầu.":
    "The end date must be after the start date.",
  "Mô tả nhiệm vụ, công nghệ sử dụng...":
    "Describe your tasks and technologies used...",
  "Ví dụ: Tôi thực tập tại FPT Software...":
    "Example: I am interning at FPT Software...",
  "Hãy nhập mô tả thông tin thực tập.":
    "Please describe your internship.",
  "Thông tin mentor doanh nghiệp": "Company mentor information",
  "Mentor doanh nghiệp": "Company mentor",
  "Người hướng dẫn": "Supervisor",
  "Họ và tên mentor": "Mentor's full name",
  "Chức vụ": "Job title",
  "Điện thoại": "Phone",
  "Vui lòng nhập tên mentor.": "Please enter the mentor's name.",
  "Vui lòng nhập tên doanh nghiệp.": "Please enter the company name.",
  "Vui lòng nhập vị trí thực tập.":
    "Please enter the internship position.",
  "Số tín chỉ đăng ký": "Registered credits",
  "2 tín chỉ": "2 credits",
  "3 tín chỉ": "3 credits",
  "4 tín chỉ": "4 credits",
  "6 tín chỉ": "6 credits",
  "Tài liệu cần chuẩn bị": "Required documents",
  "CV cá nhân": "Personal CV",
  "Giấy xác nhận hoặc Offer Letter": "Confirmation letter or Offer Letter",
  "Offer Letter hoặc giấy xác nhận": "Offer Letter or confirmation letter",
  "PDF, DOC, DOCX - tối đa 10MB": "PDF, DOC, DOCX - maximum 10 MB",
  "Chọn tệp": "Choose file",
  "Tôi xác nhận các thông tin trên là chính xác.":
    "I confirm that the information above is accurate.",
  "Kiểm tra và xác nhận": "Review and confirm",
  "Kiểm tra và gửi": "Review and submit",
  "Gửi đăng ký": "Submit application",
  "Tạo hồ sơ đăng ký": "Create application",
  "Trạng thái đăng ký": "Application status",
  "Giảng viên duyệt": "Lecturer review",
  "Chưa tạo bản nháp.": "No draft has been created.",
  "Bản nháp đã được lưu trong hệ thống.":
    "The draft has been saved in the system.",
  "Đã gửi đăng ký": "Application submitted",
  "Đã gửi - chờ duyệt": "Submitted - awaiting review",
  "Đang được xem xét": "Under review",
  "Đã được duyệt": "Approved",
  "Yêu cầu chỉnh sửa": "Revision requested",
  "Đã hủy": "Cancelled",
  "Hồ sơ đã được gửi": "Application submitted",
  "Đã gửi đăng ký thành công.": "Application submitted successfully.",
  "Bạn cần xác nhận thông tin trước khi gửi đăng ký.":
    "Please confirm the information before submitting the application.",
  "Bạn có chắc muốn xóa toàn bộ bản nháp đăng ký?":
    "Are you sure you want to delete the entire application draft?",
  "Xóa bản nháp": "Delete draft",
  "Không thể tải hồ sơ đăng ký.": "Unable to load the application.",
  "Không thể gửi đăng ký.": "Unable to submit the application.",
  "Không thể xóa bản nháp.": "Unable to delete the draft.",
  "Không thể xóa file.": "Unable to delete the file.",
  "Chỉ hỗ trợ PDF, DOC, DOCX.": "Only PDF, DOC, and DOCX are supported.",
  "Upload thất bại.": "Upload failed.",
  "Đang tải hồ sơ đăng ký...": "Loading application...",
  "Đang gửi...": "Submitting...",
  "Đang xóa": "Deleting",
  "Bắt đầu": "Start",
  "Tiếp tục": "Continue",
  "Quay lại": "Back",
  "Xác nhận": "Confirm",
  "Chưa cung cấp": "Not provided",

  // Schedules and notifications
  "Lịch & Thông báo": "Schedules & Notifications",
  "Theo dõi lời nhắc từ giảng viên, phản hồi và các mốc quan trọng trong kỳ thực tập.":
    "Track lecturer reminders, feedback, and important internship milestones.",
  "TRUNG TÂM CẬP NHẬT": "UPDATE CENTER",
  "Lịch & Deadline": "Calendar & Deadlines",
  "Sự kiện tháng này": "Events this month",
  "Chuyển tháng để xem các deadline và lịch thực tập khác.":
    "Switch months to view other deadlines and internship events.",
  "Không có sự kiện trong tháng": "No events this month",
  "Sự kiện thực tập": "Internship event",
  "Thông báo của bạn": "Your notifications",
  "Các lời nhắc và cập nhật mới sẽ xuất hiện tại đây.":
    "New reminders and updates will appear here.",
  "Tin mới nhất được lưu trực tiếp từ hệ thống.":
    "The latest updates are saved directly from the system.",
  "Cập nhật trực tiếp": "Live updates",
  "Từ giảng viên": "From lecturer",
  // Notification titles returned dynamically by the lecturer-reminder API.
  "Tin nhắn từ giảng viên": "Message from lecturer",
  "Lời nhắc từ giảng viên": "Reminder from lecturer",
  "Cảnh báo từ giảng viên": "Warning from lecturer",
  "· Giảng viên phụ trách": "· Supervising lecturer",
  "Tin mới": "New",
  "Chưa đọc": "Unread",
  "Đã đọc": "Read",
  "Đánh dấu đã đọc": "Mark as read",
  "Chưa có thông báo": "No notifications yet",
  "Làm mới": "Refresh",
  "Đang kết nối": "Connecting",
  "Đang kết nối lại": "Reconnecting",
  "Không thể cập nhật thông báo.": "Unable to update the notification.",
  "Không thể tải thông báo.": "Unable to load notifications.",
  "Đang tải thông báo...": "Loading notifications...",

  // Student settings
  "Quản lý hồ sơ cá nhân, tài khoản và tùy chọn thông báo của bạn.":
    "Manage your profile, account, and notification preferences.",
  "Hồ sơ cá nhân": "Personal profile",
  "Thông tin được sử dụng trong hồ sơ thực tập và giao tiếp với giảng viên.":
    "This information is used in your internship profile and communication with lecturers.",
  "Ảnh đại diện": "Profile picture",
  "Tải ảnh": "Upload photo",
  "Thay ảnh": "Change photo",
  "Xóa ảnh": "Remove photo",
  "Xóa ảnh đại diện hiện tại?": "Remove the current profile picture?",
  "JPG, PNG hoặc WEBP, tối đa 5 MB.":
    "JPG, PNG, or WEBP, maximum 5 MB.",
  "Chỉ hỗ trợ JPG, PNG hoặc WEBP.":
    "Only JPG, PNG, or WEBP images are supported.",
  "Ảnh không được vượt quá 5MB.": "The image must not exceed 5 MB.",
  "Không thể tải ảnh.": "Unable to upload the image.",
  "Không thể xóa ảnh.": "Unable to remove the image.",
  "Họ và tên không được để trống.": "Full name is required.",
  "Đã lưu hồ sơ": "Profile saved",
  "Không thể lưu hồ sơ.": "Unable to save the profile.",
  "Tài khoản & Bảo mật": "Account & Security",
  "Quản lý thông tin đăng nhập và bảo mật tài khoản.":
    "Manage your sign-in information and account security.",
  "Tài khoản được bảo vệ": "Account protected",
  "Đã xác minh": "Verified",
  "Cập nhật mật khẩu định kỳ để bảo vệ tài khoản.":
    "Update your password regularly to protect your account.",
  "Không chia sẻ mật khẩu hoặc thông tin đăng nhập với người khác.":
    "Do not share your password or sign-in details with others.",
  "Email đăng nhập": "Sign-in email",
  "Mật khẩu": "Password",
  "Mật khẩu hiện tại": "Current password",
  "Mật khẩu mới": "New password",
  "Xác nhận mật khẩu mới": "Confirm new password",
  "Nhập mật khẩu hiện tại và mật khẩu mới.":
    "Enter your current and new passwords.",
  "Mật khẩu mới phải có ít nhất 8 ký tự.":
    "The new password must be at least 8 characters long.",
  "Xác nhận mật khẩu mới không khớp.":
    "The new password confirmation does not match.",
  "Không thể đổi mật khẩu.": "Unable to change the password.",
  "Đổi mật khẩu thành công": "Password changed successfully",
  "Cài đặt thông báo": "Notification settings",
  "Chọn loại cập nhật mà bạn muốn nhận từ Internova.":
    "Choose the types of updates you want to receive from Internova.",
  "Deadline báo cáo": "Report deadlines",
  "Nhận nhắc nhở trước hạn nộp báo cáo.":
    "Receive reminders before report deadlines.",
  "Phản hồi từ giảng viên": "Lecturer feedback",
  "Nhận thông báo khi giảng viên nhận xét hoặc yêu cầu chỉnh sửa.":
    "Receive notifications when a lecturer comments or requests revisions.",
  "Trạng thái hồ sơ thực tập": "Internship profile status",
  "Thông báo khi hồ sơ được duyệt hoặc cần cập nhật.":
    "Receive notifications when your profile is approved or requires an update.",
  "Thông báo qua Email": "Email notifications",
  "Gửi các thông báo quan trọng đến email VinUni.":
    "Send important notifications to your VinUni email.",
  "Lưu cài đặt": "Save settings",
  "Đã lưu cài đặt thông báo": "Notification settings saved",
  "Không thể lưu cài đặt thông báo.":
    "Unable to save notification settings.",
  "Không thể lưu thông báo.": "Unable to save notifications.",
  "Đăng xuất khỏi tài khoản Internova trên thiết bị này.":
    "Sign out of your Internova account on this device.",
  "Bạn có chắc chắn muốn đăng xuất?": "Are you sure you want to sign out?",
  "Không thể tải cài đặt.": "Unable to load settings.",
  "Không thể tải cài đặt": "Unable to load settings",
  "Đang tải cài đặt...": "Loading settings...",
  "Đang cập nhật...": "Updating...",

  // Header dialogs and account menu
  "Vui lòng nhập mật khẩu hiện tại.": "Please enter your current password.",
  "Mật khẩu mới phải bao gồm ít nhất 1 chữ cái và 1 chữ số.":
    "The new password must contain at least one letter and one number.",
  "Mật khẩu xác nhận không khớp.": "The password confirmation does not match.",
  "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại thông tin.":
    "Unable to change the password. Please check your information.",
  "Đổi mật khẩu thành công!": "Password changed successfully!",
  "Không thể kết nối máy chủ. Vui lòng thử lại sau.":
    "Unable to connect to the server. Please try again later.",
  "Vui lòng nhập nội dung góp ý hoặc báo lỗi.":
    "Please enter your feedback or issue report.",
  "Cảm ơn bạn đã gửi ý kiến đóng góp! Hệ thống đã ghi nhận phản hồi của bạn.":
    "Thank you for your feedback! Your response has been recorded.",
  "Không thể gửi phản hồi. Vui lòng thử lại sau.":
    "Unable to send feedback. Please try again later.",
  "Không có thông báo chưa đọc": "No unread notifications",
  "Chưa có thông báo.": "No notifications yet.",
  "Xem tất cả thông báo": "View all notifications",
  "Tối thiểu 6 ký tự": "At least 6 characters",

  // AI chatbot interface (user messages and AI answers remain untouched unless
  // they match one of these fixed interface labels).
  "Trợ lý AI trả lời dựa trên tài liệu chính thức của nhà trường. Nếu không tìm thấy thông tin, AI sẽ cho bạn biết.":
    "The AI assistant answers using official university documents. If no information is found, it will let you know.",
  "Cuộc trò chuyện mới": "New conversation",
  "Nhập câu hỏi của bạn về học vụ, quy định, thủ tục thực tập...":
    "Ask about academic matters, regulations, or internship procedures...",
  "Các câu hỏi đã gửi": "Submitted questions",
  "Xem các câu hỏi đã gửi": "View submitted questions",
  "Câu hỏi của bạn": "Your question",
  "Đang suy nghĩ": "Thinking",
  "Đang trả lời": "Responding",
  "Đang tìm tài liệu": "Searching documents",
  "Dừng trả lời": "Stop response",
  "Gửi": "Send",
  "Cuộn lên để xem": "Scroll up to view",
  "tin nhắn cũ": "older messages",
  "Đi tới tin nhắn mới nhất": "Go to the latest message",
  "Đã có lỗi xảy ra": "An error occurred",
  "Cuộc trò chuyện bị gián đoạn.": "The conversation was interrupted.",
  "Không thể stream câu trả lời.": "Unable to stream the response.",
  "Streaming không khả dụng trên trình duyệt này.":
    "Streaming is not available in this browser.",
  "Xin lỗi, Internova AI hiện không thể xử lý câu hỏi. Vui lòng thử lại sau.":
    "Sorry, Internova AI cannot process this question right now. Please try again later.",
  "Không thể lưu lịch sử chat:": "Unable to save chat history:",
  "Không thể đọc lịch sử chat:": "Unable to read chat history:",
  "Không thể đồng bộ chat:": "Unable to synchronize chat:",
  "Biểu mẫu thực tập": "Internship form",
  "Xem mẫu": "View form",
  "Ẩn mẫu": "Hide form",
  "Tải mẫu": "Download form",
  "Mở bản xem trước trong tab mới": "Open preview in a new tab",
  "Nhập thông tin bổ sung cho đơn...":
    "Enter additional information for the form...",
  "Gõ 'có' hoặc 'không'...": "Type 'yes' or 'no'...",
  "nguồn tham khảo": "references",
  "Độ tin cậy": "Confidence",
  "đơn này": "this form",

  // Remaining report/profile/dashboard content and backend-provided defaults.
  "Báo cáo tuần (nếu kỳ yêu cầu)": "Weekly report (if required)",
  "Bạn chắc chắn muốn nộp?": "Are you sure you want to submit?",
  "Bạn cần có kỳ thực tập trước khi tạo báo cáo.":
    "You need an internship period before creating a report.",
  "Bạn cần có kỳ thực tập": "You need an internship period",
  "trước khi tạo báo cáo.": "before creating a report.",
  "để bắt đầu.": "to get started.",
  "Final Report cần có Letter of Completion.":
    "The Final Report requires a Letter of Completion.",
  "Completion thất bại.": "Completion upload failed.",
  "Nhận xét": "Comments",
  "Mô tả công việc trong tuần,": "Describe this week's work,",
  "kết quả đạt được, khó khăn,": "results, challenges,",
  "bài học và kế hoạch tiếp theo...": "lessons learned, and next steps...",
  "Mô tả tiến độ internship,": "Describe internship progress,",
  "công việc đã hoàn thành,": "completed work,",
  "kết quả hiện tại, khó khăn,": "current results and challenges,",
  "kỹ năng đã học và kế hoạch": "skills learned and plans",
  "cho giai đoạn tiếp theo...": "for the next phase...",
  "Tổng kết internship: mục tiêu,": "Summarize the internship: objectives,",
  "công việc đã thực hiện, kết quả,": "completed work and results,",
  "kỹ năng/kiến thức học được,": "acquired skills and knowledge,",
  "khó khăn và bài học...": "challenges and lessons learned...",
  "Phản ánh learning outcomes,": "Reflect on learning outcomes,",
  "điều học được, sự phát triển": "lessons learned and personal",
  "cá nhân, nghề nghiệp và những": "and professional growth, and what",
  "điều bạn sẽ làm khác trong tương lai...":
    "you would do differently in the future...",
  "Ví dụ: Mid-term Internship Report": "Example: Mid-term Internship Report",
  "Ví dụ: 4": "Example: 4",
  "Nộp báo cáo cuối kỳ": "Submit final report",
  "Sinh viên nộp báo cáo cuối kỳ.": "Students submit the final report.",
  "Không thể tải dashboard.": "Unable to load the dashboard.",
  "Không thể tải dashboard": "Unable to load the dashboard",
  "Đang tải dashboard...": "Loading dashboard...",
  "Ngày mai": "Tomorrow",
  "Kết thúc": "Finish",
  "Mô tả công việc": "Job description",
  "Ngành": "Major",
  "Thực tập": "Internship",
  "Tín chỉ": "Credits",
  "Xóa": "Delete",
  "Cài đặt": "Settings",
  "Mã sinh viên": "Student ID",
  "Đăng xuất": "Sign out",
  "Đổi mật khẩu": "Change password",
  "Tài khoản đăng nhập qua": "Account signed in through",
  "Xóa \"": "Delete \"",
  "Sắp đến hạn báo cáo": "Report deadline approaching",
  "Bạn sắp đến hạn nộp báo cáo.":
    "Your report submission deadline is approaching.",
  "Nộp báo cáo thực tập.": "Submit the internship report.",

  // Messages returned by student-facing API endpoints
  "Chỉ sinh viên mới được sử dụng chức năng này.":
    "Only students can use this feature.",
  "Chỉ hỗ trợ PDF, DOC và DOCX.":
    "Only PDF, DOC, and DOCX files are supported.",
  "File rỗng.": "The file is empty.",
  "Không tìm thấy tài liệu.": "Document not found.",
  "Tải tài liệu thành công.": "Document uploaded successfully.",
  "Đã xóa tài liệu.": "Document deleted.",
  "Định dạng file không được hỗ trợ.": "Unsupported file format.",
  "AI Review chỉ sử dụng khi báo cáo đang chỉnh sửa.":
    "AI Review is available only while a report is being edited.",
  "AI Review hiện không thể xử lý báo cáo.":
    "AI Review cannot process the report right now.",
  "Báo cáo chưa có file.": "The report does not have a file yet.",
  "Báo cáo chưa có nội dung để AI Review.":
    "The report does not have content for AI Review.",
  "Báo cáo chỉ hỗ trợ file PDF và DOCX.":
    "Reports support PDF and DOCX files only.",
  "Chưa có Letter of Completion.": "No Letter of Completion has been uploaded.",
  "Chỉ có thể xóa báo cáo ở trạng thái bản nháp.":
    "Only draft reports can be deleted.",
  "Không thể chỉnh sửa báo cáo. Báo cáo có thể đã được nộp.":
    "Unable to edit the report. It may already have been submitted.",
  "Không thể cập nhật file. Báo cáo có thể đã được nộp.":
    "Unable to update the file. The report may already have been submitted.",
  "Không tìm thấy báo cáo.": "Report not found.",
  "Letter of Completion chỉ hỗ trợ PDF, DOCX, JPG hoặc PNG.":
    "The Letter of Completion supports PDF, DOCX, JPG, or PNG files only.",
  "Letter of Completion chỉ được gắn với Final Report chưa được nộp.":
    "A Letter of Completion can only be attached to an unsubmitted Final Report.",
  "Đã lưu Letter of Completion.": "Letter of Completion saved.",
  "Đã lưu file báo cáo.": "Report file saved.",
  "Đã nộp báo cáo.": "Report submitted.",
  "Chưa có ảnh đại diện.": "No profile picture is available.",
  "Đổi mật khẩu thành công.": "Password changed successfully.",
  "Ảnh rỗng.": "The image is empty.",
  "Không tìm thấy sự kiện.": "Event not found.",
  "Không tìm thấy thông báo.": "Notification not found.",
  "Không tìm thấy sinh viên.": "Student not found.",
};

const LECTURER_PORTAL_VI_TO_EN: Record<string, string> = {
  // Shared lecturer shell, navigation, states, and validation.
  "Hỗ trợ thực tập sinh viên": "Student Internship Support",
  "Chọn ngôn ngữ": "Select language",
  "Tiếng Việt": "Vietnamese",
  "Giảng viên": "Lecturer",
  "QUẢN LÝ THỰC TẬP": "INTERNSHIP MANAGEMENT",
  "THEO DÕI THỰC TẬP": "INTERNSHIP MONITORING",
  "THEO DÕI SINH VIÊN": "STUDENT MONITORING",
  "Đang xác thực tài khoản giảng viên": "Verifying lecturer account",
  "Vui lòng chờ trong giây lát…": "Please wait a moment…",
  "Phiên đăng nhập không hợp lệ.": "Invalid login session.",
  "Backend không trả về JSON hợp lệ.": "The backend did not return valid JSON.",
  "Backend trả về lỗi": "Backend returned error",
  "API trả về": "API returned",
  "thay vì JSON:": "instead of JSON:",
  "Yêu cầu không thành công.": "The request was unsuccessful.",
  "Đã xảy ra lỗi không xác định.": "An unknown error occurred.",
  "Không thể tải dữ liệu": "Unable to load data",
  "Không tìm thấy dữ liệu.": "No data found.",
  "Thử thay đổi từ khóa hoặc bộ lọc trạng thái.":
    "Try changing the keyword or status filter.",
  "Tất cả trạng thái": "All statuses",
  "Chưa có": "Not available",
  "Chưa có lớp": "No class assigned",
  "Chưa có lớp/khóa": "No class/cohort",
  "Chưa có ngành": "No major provided",
  "Chưa cập nhật ngành": "Major not updated",
  "Chưa cập nhật vị trí": "Position not updated",
  "Chưa cập nhật doanh nghiệp": "Company not updated",
  "Không xác định": "Unknown",
  "Chưa nộp": "Not submitted",
  "Chưa tới hạn": "Not due yet",
  "Sắp đến hạn": "Due soon",
  "Đúng hạn": "On time",
  "Nộp đúng hạn": "Submitted on time",
  "Chờ chấm": "Awaiting grading",
  "Đã chấm": "Graded",
  "Chưa chấm": "Not graded",
  "Cần sửa": "Revision needed",
  "Cần chú ý": "Needs attention",
  "Có cảnh báo": "Has warnings",
  "Không cảnh báo": "No warnings",
  "Không có cảnh báo": "No warnings",
  "Không có cảnh báo.": "No warnings.",
  "Tất cả đợt": "All periods",
  "Tất cả doanh nghiệp": "All companies",
  "Tất cả báo cáo": "All reports",
  "Tất cả cảnh báo": "All warnings",
  "Lọc": "Filter",
  "Xóa lọc": "Clear filters",
  "Quay lại danh sách": "Back to list",
  "Quay lại chi tiết": "Back to details",
  "Trang trước": "Previous page",
  "Trước": "Previous",
  "Xuất CSV": "Export CSV",

  // Lecturer dashboard and student management.
  "Phân tích AI": "AI Analysis",
  "Thống kê": "Statistics",
  "THỐNG KÊ & BÁO CÁO": "STATISTICS & REPORTS",
  "Tổng sinh viên": "Total students",
  "sinh viên đã có điểm": "students have been graded",
  "sinh viên có cảnh báo hoặc chậm tiến độ":
    "students have warnings or delayed progress",
  "báo cáo đến hạn": "reports due",
  "báo cáo đúng hạn": "reports submitted on time",
  "Chưa có mã SV": "No student ID",
  "Theo dõi": "Monitor",
  "% thực tập": "% internship progress",
  "Báo cáo:": "Report:",
  "Quản lý sinh viên": "Student management",
  "Theo dõi tiến độ, báo cáo, đánh giá và cảnh báo của sinh viên đang được bạn hướng dẫn.":
    "Track the progress, reports, evaluations, and warnings of your supervised students.",
  "Dữ liệu được truy vấn trực tiếp từ PostgreSQL.":
    "Data is queried directly from PostgreSQL.",
  "Tìm tên, mã SV, doanh nghiệp...": "Search name, student ID, company...",
  "Đang truy vấn PostgreSQL...": "Querying PostgreSQL...",
  "Đang truy xuất chi tiết từ PostgreSQL...":
    "Loading details from PostgreSQL...",
  "Hãy kiểm tra bộ lọc hoặc dữ liệu trong database.":
    "Check the filters or database records.",
  "HỒ SƠ SINH VIÊN": "STUDENT PROFILE",
  "Báo cáo (": "Reports (",
  "Ghi chú (": "Notes (",
  "Đánh giá gần nhất": "Latest evaluation",
  "Chưa đánh giá": "Not evaluated",
  "Chưa có nhận xét AI.": "No AI comments yet.",
  "Chưa có nhận xét.": "No comments yet.",
  "Chưa có đánh giá.": "No evaluation yet.",
  "Thái độ": "Attitude",
  "Chuyên môn": "Professional skills",
  "Kỹ năng": "Skills",
  "Tổng": "Total",
  "Gửi nhắc nhở": "Send reminder",
  "Gửi thông báo": "Send notification",
  "Nộp:": "Submitted:",
  "Điểm:": "Score:",
  "AI đầy đủ:": "AI completeness:",
  "Thêm ghi chú nội bộ": "Add internal note",
  "Nhập nội dung cần lưu...": "Enter the note content...",
  "Lưu vào PostgreSQL": "Save to PostgreSQL",
  "Chưa có ghi chú.": "No notes yet.",
  "Đã lưu ghi chú vào PostgreSQL.": "Note saved to PostgreSQL.",
  "Đã lưu thông báo nhắc nhở vào PostgreSQL.":
    "Reminder notification saved to PostgreSQL.",
  "Không thể lưu ghi chú.": "Unable to save the note.",
  "Không thể gửi nhắc nhở.": "Unable to send the reminder.",
  "Ghi chú phải có từ 1 đến 4000 ký tự.":
    "The note must contain between 1 and 4,000 characters.",
  "Nội dung nhắc nhở phải có từ 1 đến 2000 ký tự.":
    "The reminder must contain between 1 and 2,000 characters.",
  "Em vui lòng kiểm tra và cập nhật tiến độ thực tập, báo cáo còn thiếu trên hệ thống.":
    "Please review and update your internship progress and any missing reports in the system.",
  "Danh sách sinh viên": "Student list",
  "Theo dõi tiến độ thực tập, tình trạng báo cáo, điểm số và cảnh báo của từng sinh viên.":
    "Track each student's internship progress, report status, scores, and warnings.",
  "Thêm sinh viên": "Add student",
  "Tìm theo tên, mã SV, lớp, ngành, doanh nghiệp hoặc vị trí...":
    "Search by name, student ID, class, major, company, or position...",
  "Đang tải danh sách sinh viên...": "Loading students...",
  "Không thể tải danh sách sinh viên.": "Unable to load students.",
  "Không tìm thấy sinh viên": "No students found",
  "Lớp / Ngành": "Class / Major",
  "Báo cáo gần nhất": "Latest report",
  "Chi tiết sinh viên": "Student details",
  "Sửa thông tin": "Edit information",
  "Đang tải thông tin sinh viên...": "Loading student information...",
  "Không thể hiển thị sinh viên": "Unable to display the student",
  "MÃ SV · LỚP · NGÀNH": "STUDENT ID · CLASS · MAJOR",
  "Thông tin học tập": "Academic information",
  "SINH VIÊN": "STUDENT",
  "THỰC TẬP": "INTERNSHIP",
  "BÁO CÁO": "REPORT",
  "THEO DÕI": "MONITORING",
  "ĐÁNH GIÁ": "EVALUATION",
  "TỔNG QUAN": "OVERVIEW",
  "Tiến độ thực tập": "Internship progress",
  "Tiến độ hiện tại": "Current progress",
  "Điểm trung bình": "Average score",
  "Kỳ báo cáo gần nhất": "Latest reporting period",
  "Hạn nộp": "Due date",
  "Ngày nộp": "Submission date",
  "Điểm": "Score",
  "Chưa có kỳ báo cáo nào.": "No reporting periods yet.",
  "báo cáo phải nộp tính đến hiện tại.": "required reports to date.",
  "Tình trạng cần chú ý": "Items requiring attention",
  "mục cần chú ý": "items requiring attention",
  "Hệ thống đang ghi nhận báo cáo quá hạn, báo cáo nộp muộn hoặc cảnh báo liên quan đến sinh viên này.":
    "The system has recorded overdue or late reports, or warnings related to this student.",
  "Sinh viên hiện không có mục cần chú ý.":
    "This student currently has no items requiring attention.",
  "Hồ sơ sinh viên": "Student profile",
  "Sửa sinh viên": "Edit student",
  "Sửa thông tin sinh viên": "Edit student information",
  "Cập nhật thông tin thực tập của sinh viên đang thuộc quyền hướng dẫn của bạn.":
    "Update internship information for a student under your supervision.",
  "Đang tải thông tin...": "Loading information...",
  "Có thể cập nhật lớp; các thông tin học tập còn lại được lấy từ hồ sơ sinh viên.":
    "You can update the class; other academic information comes from the student profile.",
  "Lớp sinh viên": "Student class",
  "Học kỳ *": "Semester *",
  "-- Chọn học kỳ --": "-- Select semester --",
  "-- Chưa chọn --": "-- Not selected --",
  "Bạn chưa chọn học kỳ.": "Please select a semester.",
  "Mã sinh viên không hợp lệ.": "Invalid student ID.",
  "Mã sinh viên trên đường dẫn không hợp lệ.":
    "The student ID in the URL is invalid.",
  "Đã cập nhật thông tin sinh viên.": "Student information updated.",
  "Không thể cập nhật sinh viên.": "Unable to update the student.",
  "Không thể tải thông tin sinh viên.": "Unable to load student information.",

  // Internship periods.
  "Danh sách đợt thực tập": "Internship period list",
  "Theo dõi các đợt thực tập, thời gian triển khai, số lượng sinh viên, tiến độ và các trường hợp cần chú ý.":
    "Track internship periods, schedules, student counts, progress, and cases requiring attention.",
  "Tổng số đợt": "Total periods",
  "Tìm theo tên đợt, mã học kỳ hoặc năm học...":
    "Search by period name, semester code, or academic year...",
  "Đang diễn ra": "In progress",
  "Sắp diễn ra": "Upcoming",
  "Đã kết thúc": "Ended",
  "Không tìm thấy đợt thực tập": "No internship periods found",
  "Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.":
    "Try changing the search term or status filter.",
  "Báo cáo phải nộp": "Required reports",
  "Tiến độ đợt thực tập": "Internship period progress",
  "Sửa": "Edit",
  "Tạo đợt thực tập": "Create internship period",
  "Thêm học kỳ và thời gian triển khai mới.":
    "Add a new semester and implementation schedule.",
  "Tên đợt thực tập": "Internship period name",
  "Mã học kỳ": "Semester code",
  "Năm học": "Academic year",
  "Ngày kết thúc không được trước ngày bắt đầu.":
    "The end date cannot be before the start date.",
  "Không thể tạo đợt thực tập.": "Unable to create the internship period.",
  "Chi tiết đợt thực tập": "Internship period details",
  "Đang tải thông tin đợt thực tập...": "Loading internship period...",
  "Không thể hiển thị đợt thực tập": "Unable to display the internship period",
  "Chưa có mã học kỳ": "No semester code",
  "Chưa có năm học": "No academic year",
  "Chưa có mô tả cho đợt thực tập này.":
    "No description is available for this internship period.",
  "Sửa đợt thực tập": "Edit internship period",
  "Cập nhật thông tin học kỳ và thời gian triển khai.":
    "Update the semester information and implementation schedule.",
  "Đang tải dữ liệu...": "Loading data...",
  "Không thể tải đợt thực tập.": "Unable to load the internship period.",
  "Không thể lưu thay đổi.": "Unable to save changes.",
  "Mã đợt thực tập trên đường dẫn không hợp lệ.":
    "The internship period ID in the URL is invalid.",

  // Internship application review.
  "XÉT DUYỆT THỰC TẬP": "INTERNSHIP APPLICATION REVIEW",
  "Kiểm tra thông tin, tài liệu và quyết định tiếp nhận hồ sơ.":
    "Review the information and documents, then decide whether to accept the application.",
  "Tổng hồ sơ": "Total applications",
  "Mới gửi": "Newly submitted",
  "Từ chối": "Rejected",
  "Tìm hồ sơ": "Search applications",
  "Tên, mã sinh viên, doanh nghiệp, vị trí...":
    "Name, student ID, company, position...",
  "Tất cả hình thức": "All work arrangements",
  "Tại doanh nghiệp": "At the company",
  "Danh sách hồ sơ": "Application list",
  "hồ sơ phù hợp": "matching applications",
  "Không có hồ sơ phù hợp bộ lọc.":
    "No applications match the filters.",
  "Đang tải chi tiết hồ sơ...": "Loading application details...",
  "Chưa có hồ sơ để hiển thị.": "No application to display.",
  "HỒ SƠ #": "APPLICATION #",
  "Gửi lúc": "Submitted at",
  "Thông tin học tập và liên hệ": "Academic and contact information",
  "Lớp / Khóa": "Class / Cohort",
  "Doanh nghiệp và mentor": "Company and mentor",
  "Đơn vị tiếp nhận sinh viên": "Student host organization",
  "Chưa cập nhật lĩnh vực": "Industry not updated",
  "Chưa cập nhật địa chỉ": "Address not updated",
  "Chưa cập nhật điện thoại mentor": "Mentor phone not updated",
  "Nội dung đăng ký thực tập": "Internship application details",
  "Vị trí, thời gian và mô tả công việc":
    "Position, dates, and job description",
  "Số tín chỉ": "Credits",
  "Sinh viên chưa cung cấp mô tả công việc.":
    "The student has not provided a job description.",
  "tài liệu đính kèm": "attached documents",
  "tài liệu": "documents",
  "Thư tiếp nhận": "Acceptance letter",
  "Tài liệu khác": "Other document",
  "Xem tài liệu": "View document",
  "Tải tài liệu": "Download document",
  "Sinh viên chưa tải tài liệu lên cho hồ sơ này.":
    "The student has not uploaded documents for this application.",
  "Xét duyệt hồ sơ": "Review application",
  "Kết quả sẽ được gửi thông báo cho sinh viên":
    "The decision will be sent to the student",
  "Bắt đầu xem xét": "Start review",
  "Phê duyệt": "Approve",
  "Duyệt hồ sơ": "Approve application",
  "Xác nhận từ chối": "Confirm rejection",
  "Lý do từ chối (bắt buộc)": "Reason for rejection (required)",
  "Nhận xét của giảng viên": "Lecturer comments",
  "Nêu rõ nội dung sinh viên cần điều chỉnh...":
    "Clearly describe what the student needs to revise...",
  "Nhập nhận xét nếu cần...": "Enter comments if needed...",
  "Hồ sơ đã được phê duyệt": "Application approved",
  "Hồ sơ đã bị từ chối": "Application rejected",
  "Xử lý lúc": "Processed at",
  "Đã tạo kỳ thực tập #": "Created internship #",
  "cho sinh viên.": "for the student.",
  "Duyệt hồ sơ này và tạo kỳ thực tập cho sinh viên?":
    "Approve this application and create an internship for the student?",
  "Xác nhận từ chối hồ sơ và gửi lý do cho sinh viên?":
    "Reject this application and send the reason to the student?",
  "Vui lòng nhập lý do từ chối hồ sơ.":
    "Please enter a reason for rejecting the application.",
  "Đã chuyển hồ sơ sang trạng thái đang xem xét.":
    "The application is now under review.",
  "Đã duyệt hồ sơ và tạo kỳ thực tập cho sinh viên.":
    "The application was approved and an internship was created for the student.",
  "Đã từ chối hồ sơ và gửi thông báo cho sinh viên.":
    "The application was rejected and the student was notified.",
  "Không thể cập nhật hồ sơ.": "Unable to update the application.",
  "Không thể lưu kết quả xét duyệt.": "Unable to save the review decision.",
  "Không thể tải chi tiết hồ sơ.": "Unable to load application details.",
  "Không thể tải danh sách hồ sơ.": "Unable to load applications.",

  // Lecturer evaluations.
  "Đánh giá thực tập": "Internship evaluations",
  "KẾT QUẢ THỰC TẬP": "INTERNSHIP RESULTS",
  "Đánh giá sinh viên": "Student evaluations",
  "Theo dõi căn cứ, chấm điểm và xác nhận kết quả giữa kỳ hoặc cuối kỳ.":
    "Review supporting evidence, assign scores, and confirm midterm or final results.",
  "Tổng lượt": "Total evaluations",
  "Đã xác nhận": "Confirmed",
  "Tìm sinh viên": "Search students",
  "Trạng thái đánh giá": "Evaluation status",
  "Loại đánh giá": "Evaluation type",
  "Giữa kỳ và cuối kỳ": "Midterm and final",
  "Đánh giá giữa kỳ": "Midterm evaluation",
  "Đánh giá cuối kỳ": "Final evaluation",
  "Giữa kỳ": "Midterm",
  "Cuối kỳ": "Final",
  "Báo cáo tổng kết": "Reflection report",
  "Đang tải danh sách đánh giá...": "Loading evaluations...",
  "Phiếu đánh giá": "Evaluation forms",
  "lượt phù hợp": "matching evaluations",
  "Không có lượt đánh giá phù hợp bộ lọc.":
    "No evaluations match the filters.",
  "Đang tải phiếu đánh giá...": "Loading evaluation form...",
  "Chọn một sinh viên để bắt đầu đánh giá.":
    "Select a student to begin the evaluation.",
  "· KỲ THỰC TẬP #": "· INTERNSHIP #",
  "Giờ thực tập": "Internship hours",
  "Báo cáo đã nộp": "Reports submitted",
  "TB báo cáo": "Average report score",
  "Thông tin sinh viên và đơn vị tiếp nhận":
    "Student and host organization information",
  "Nội dung cần lưu ý": "Items to review",
  "Không chặn đánh giá nhưng cần được giảng viên kiểm tra":
    "These items do not block the evaluation but should be reviewed by the lecturer",
  "Căn cứ từ báo cáo": "Report evidence",
  "Điểm, thời hạn và phản hồi đã ghi nhận":
    "Recorded scores, deadlines, and feedback",
  "· Nộp": "· Submitted",
  "Quá hạn": "Overdue",
  "Chưa có báo cáo cho kỳ thực tập này.":
    "No reports are available for this internship.",
  "Đánh giá đối chiếu": "Comparative evaluations",
  "Ý kiến từ mentor, sinh viên hoặc quản trị viên":
    "Feedback from the mentor, student, or administrator",
  "Sinh viên tự đánh giá": "Student self-evaluation",
  "Quản trị viên": "Administrator",
  "Chưa cập nhật người đánh giá": "Evaluator not updated",
  "Chưa có đánh giá từ các bên khác.":
    "No evaluations from other parties yet.",
  "Kết quả đã xác nhận": "Confirmed result",
  "Phiếu đánh giá của giảng viên": "Lecturer evaluation form",
  "Xác nhận lúc": "Confirmed at",
  "Tổng điểm được tính trên thang 10": "The total score uses a 10-point scale",
  "Tổng điểm": "Total score",
  "Nhận xét về kết quả, thái độ và mức độ hoàn thành...":
    "Comment on results, attitude, and completion level...",
  "Điểm mạnh": "Strengths",
  "Năng lực, thái độ hoặc kết quả nổi bật...":
    "Notable skills, attitude, or achievements...",
  "Nội dung cần cải thiện": "Areas for improvement",
  "Nội dung sinh viên cần tiếp tục cải thiện...":
    "Areas the student should continue to improve...",
  "Lưu nháp": "Save draft",
  "Cập nhật bản đã nộp": "Update submission",
  "Nộp đánh giá": "Submit evaluation",
  "Xác nhận kết quả": "Confirm result",
  "Tổng điểm phải nằm trong khoảng từ 0 đến 10.":
    "The total score must be between 0 and 10.",
  "Vui lòng nhập tổng điểm trước khi nộp đánh giá.":
    "Please enter a total score before submitting the evaluation.",
  "Vui lòng nhập nhận xét chung trước khi nộp đánh giá.":
    "Please enter general feedback before submitting the evaluation.",
  "Cần nhập điểm mạnh và nội dung cần cải thiện trước khi xác nhận.":
    "Enter strengths and areas for improvement before confirming.",
  "Không thể tải phiếu đánh giá.": "Unable to load the evaluation form.",
  "Không thể tải dữ liệu đánh giá.": "Unable to load evaluation data.",
  "Không thể lưu phiếu đánh giá.": "Unable to save the evaluation form.",
  "Bạn có chắc muốn": "Are you sure you want to",
  "xác nhận và khóa": "confirm and lock",
  "phiếu đánh giá": "evaluation form",
  "nộp": "submit",
  "báo cáo": "reports",

  // Lecturer report review.
  "Kỳ nộp, thời gian nộp và trạng thái đánh giá.":
    "Reporting periods, submission times, and evaluation status.",
  "Tổng kỳ báo cáo": "Total reporting periods",
  "Quá hạn chưa nộp": "Overdue and not submitted",
  "Chờ đánh giá": "Awaiting evaluation",
  "Đang đánh giá": "Under evaluation",
  "Chưa đến hạn": "Not due yet",
  "Chưa có bản nộp": "No submission",
  "Tìm báo cáo": "Search reports",
  "Tên, mã sinh viên, báo cáo, doanh nghiệp...":
    "Name, student ID, report, company...",
  "Tình trạng nộp": "Submission status",
  "Tất cả tình trạng nộp": "All submission statuses",
  "Tất cả đánh giá": "All evaluations",
  "Tất cả loại": "All types",
  "Hàng tuần": "Weekly",
  "Tổng kết": "Reflection",
  "Đang tải nhật ký báo cáo...": "Loading report records...",
  "mục phù hợp": "matching items",
  "Không có báo cáo phù hợp bộ lọc.": "No reports match the filters.",
  "Chưa có báo cáo để hiển thị.": "No report to display.",
  "Đang tải chi tiết...": "Loading details...",
  "Thời gian nộp": "Submission time",
  "Thời gian đánh giá": "Evaluation time",
  "So sánh trực tiếp thời gian nộp với hạn nộp.":
    "Compares the submission time directly with the deadline.",
  "Đã quá hạn nhưng chưa có bản nộp": "Overdue with no submission",
  "Sinh viên chưa tạo hoặc chưa nộp báo cáo cho kỳ này.":
    "The student has not created or submitted a report for this period.",
  "Chưa có nội dung báo cáo.": "No report content yet.",
  "Tệp đính kèm": "Attachments",
  "Tệp báo cáo": "Report file",
  "· Giấy xác nhận hoàn thành": "· Completion letter",
  "Xem giấy xác nhận": "View completion letter",
  "Tải giấy xác nhận": "Download completion letter",
  "Xem file báo cáo": "View report file",
  "Tải file báo cáo": "Download report file",
  "Đánh giá báo cáo": "Report evaluation",
  "Duyệt": "Approve",
  "Yêu cầu sửa": "Request revision",
  "Điểm (0-10)": "Score (0-10)",
  "Phản hồi": "Feedback",
  "Lưu đánh giá": "Save evaluation",
  "Đã lưu đánh giá và gửi thông báo cho sinh viên.":
    "The evaluation was saved and the student was notified.",
  "Điểm duyệt phải nằm trong khoảng 0 đến 10.":
    "The review score must be between 0 and 10.",
  "Vui lòng nhập phản hồi khi yêu cầu chỉnh sửa.":
    "Enter feedback when requesting a revision.",
  "Không thể lưu đánh giá.": "Unable to save the evaluation.",
  "Không thể tải chi tiết báo cáo.": "Unable to load report details.",
  "Không thể mở báo cáo.": "Unable to open the report.",
  "Trao đổi": "Messages",
  "Nội dung trao đổi": "Message content",
  "Nhập phản hồi cho sinh viên...": "Enter feedback for the student...",
  "Gửi phản hồi": "Send feedback",
  "Chưa có trao đổi cho báo cáo này.":
    "No messages for this report yet.",
  "Không thể gửi trao đổi.": "Unable to send the message.",
  "phản hồi": "feedback",
  "ngày": "days",
  "giờ": "hours",
  "phút": "minutes",

  // Lecturer settings.
  "HỒ SƠ GIẢNG VIÊN": "LECTURER PROFILE",
  "Quản lý hồ sơ, bảo mật tài khoản và cách bạn nhận thông báo.":
    "Manage your profile, account security, and notification preferences.",
  "Đang tải cài đặt…": "Loading settings…",
  "Thông tin giảng viên": "Lecturer information",
  "Thông tin này được hiển thị trong khu vực quản lý sinh viên.":
    "This information is displayed in the student management area.",
  "Mã giảng viên": "Lecturer ID",
  "Chưa có mã giảng viên": "No lecturer ID",
  "Nhập số điện thoại": "Enter phone number",
  "Học hàm / học vị": "Academic title / degree",
  "Khoa / Viện": "Faculty / Institute",
  "Mô tả lĩnh vực chuyên môn và hướng nghiên cứu…":
    "Describe your expertise and research interests…",
  "* Thông tin bắt buộc": "* Required information",
  "Đổi ảnh đại diện": "Change profile picture",
  "Đổi ảnh": "Change picture",
  "JPG, PNG hoặc WEBP · Tối đa 5MB": "JPG, PNG, or WEBP · Maximum 5 MB",
  "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.":
    "Only JPG, PNG, or WEBP images are supported.",
  "Bạn muốn xóa ảnh đại diện hiện tại?":
    "Do you want to remove the current profile picture?",
  "Đã cập nhật ảnh đại diện.": "Profile picture updated.",
  "Đã xóa ảnh đại diện.": "Profile picture removed.",
  "Không thể tải ảnh lên.": "Unable to upload the picture.",
  "Đã lưu thông tin cá nhân.": "Personal information saved.",
  "Tài khoản & bảo mật": "Account & security",
  "Kiểm tra phương thức đăng nhập và bảo vệ tài khoản.":
    "Review your sign-in method and account security.",
  "Phương thức đăng nhập": "Sign-in method",
  "Tài khoản Google": "Google account",
  "Email và mật khẩu": "Email and password",
  "An toàn": "Secure",
  "Nên đổi mật khẩu định kỳ và không dùng chung với dịch vụ khác.":
    "Change your password regularly and do not reuse it for other services.",
  "Mật khẩu mới cần có ít nhất 8 ký tự.":
    "The new password must contain at least 8 characters.",
  "Đã đổi mật khẩu thành công.": "Password changed successfully.",
  "Đăng xuất khỏi tài khoản": "Sign out of account",
  "Xóa phiên đăng nhập trên trình duyệt hiện tại.":
    "Remove the login session from this browser.",
  "Tùy chọn thông báo": "Notification preferences",
  "Chọn các hoạt động bạn muốn được hệ thống nhắc nhở.":
    "Choose the activities you want the system to notify you about.",
  "Hạn nộp báo cáo": "Report deadlines",
  "Nhận cảnh báo khi sinh viên sắp đến hạn hoặc quá hạn báo cáo.":
    "Receive alerts when students approach or miss report deadlines.",
  "Trao đổi với sinh viên": "Student messages",
  "Nhận thông báo khi có tin nhắn hoặc phản hồi mới từ sinh viên.":
    "Receive notifications for new student messages or replies.",
  "Theo dõi thay đổi hồ sơ, phân công và trạng thái kỳ thực tập.":
    "Track profile, assignment, and internship status changes.",
  "Trạng thái thực tập": "Internship status",
  "Gửi thêm bản sao các thông báo quan trọng tới email của bạn.":
    "Also send copies of important notifications to your email.",
  "Có thể thay đổi bất cứ lúc nào.": "You can change this at any time.",
  "Lưu tùy chọn": "Save preferences",
  "Đã lưu tùy chọn thông báo.": "Notification preferences saved.",
  "Yêu cầu thất bại (": "Request failed (",

  // Lecturer notification center.
  "TRUNG TÂM THÔNG BÁO": "NOTIFICATION CENTER",
  "Thông báo của giảng viên": "Lecturer notifications",
  "Theo dõi báo cáo, hồ sơ, đánh giá và các cập nhật cần xử lý.":
    "Track reports, applications, evaluations, and updates requiring action.",
  "Tìm kiếm thông báo": "Search notifications",
  "Tìm theo tiêu đề hoặc nội dung...": "Search by title or content...",
  "Lọc theo trạng thái": "Filter by status",
  "Mức độ": "Severity",
  "Lọc theo mức độ": "Filter by severity",
  "Chủ đề": "Topic",
  "Lọc theo chủ đề": "Filter by topic",
  "Khẩn cấp": "Critical",
  "Thành công": "Success",
  "Tổng quan thông báo": "Notification overview",
  "Tổng thông báo": "Total notifications",
  "Trong hôm nay": "Today",
  "Báo cáo mới": "New report",
  "Báo cáo cần xử lý": "Reports requiring action",
  "Một báo cáo đang chờ giảng viên review.":
    "A report is awaiting lecturer review.",
  "vừa nộp báo cáo tuần.": "just submitted a weekly report.",
  "Cảnh báo báo cáo": "Report warning",
  "Phản hồi báo cáo": "Report feedback",
  "Hồ sơ mới": "New application",
  "Kết quả hồ sơ": "Application result",
  "Nhắc nhở": "Reminders",
  "Hệ thống": "System",
  "Không rõ thời gian": "Unknown time",
  "Hộp thông báo": "Notification inbox",
  "Đánh dấu tất cả đã đọc": "Mark all as read",
  "Dọn thông báo đã đọc": "Clear read notifications",
  "Xóa tất cả thông báo đã đọc? Thao tác này không thể hoàn tác.":
    "Delete all read notifications? This action cannot be undone.",
  "Không thể tải thông báo": "Unable to load notifications",
  "Không thể tải danh sách thông báo.": "Unable to load notifications.",
  "Không thể thực hiện thao tác.": "Unable to complete the action.",
  "Đóng lỗi": "Dismiss error",
  "Hộp thông báo đang trống": "The notification inbox is empty",
  "Không có kết quả phù hợp": "No matching results",
  "Hãy thay đổi từ khóa hoặc bộ lọc để xem thêm thông báo.":
    "Change the keyword or filters to view more notifications.",
  "Thông báo mới về sinh viên và công việc phụ trách sẽ xuất hiện tại đây.":
    "New notifications about students and assigned work will appear here.",
  "Xóa bộ lọc": "Clear filters",
  "Đánh dấu chưa đọc": "Mark as unread",
  "Xóa thông báo": "Delete notification",
  "Bạn có chắc muốn xóa thông báo này?":
    "Are you sure you want to delete this notification?",
  "thông báo": "notifications",
  "phù hợp": "matching",

  // Lecturer reminders and warnings.
  "Phát hiện vấn đề và gửi lời nhắc trực tiếp đến từng sinh viên.":
    "Identify issues and send reminders directly to individual students.",
  "Sinh viên phụ trách": "Assigned students",
  "Tin đã gửi": "Messages sent",
  "Sinh viên chưa đọc": "Students have not read",
  "Lọc sinh viên": "Filter students",
  "Tất cả sinh viên": "All students",
  "Đã gửi tin": "Message sent",
  "Đang cần chú ý": "Needs attention",
  "Đang tải dữ liệu cảnh báo...": "Loading warning data...",
  "sinh viên phù hợp": "matching students",
  "Chưa gửi tin": "No messages sent",
  "Không có sinh viên phù hợp bộ lọc.":
    "No students match the filters.",
  "Đang tải cuộc trao đổi...": "Loading conversation...",
  "Chọn sinh viên để xem cảnh báo và gửi lời nhắc.":
    "Select a student to view warnings and send a reminder.",
  "Cảnh báo hệ thống": "System warnings",
  "Tổng hợp tự động từ tiến độ và hạn báo cáo":
    "Automatically generated from progress and report deadlines",
  "Chưa phát hiện nội dung bất thường.": "No issues detected.",
  "Lịch sử nhắc nhở": "Reminder history",
  "Tin gửi tới hộp thông báo của sinh viên":
    "Messages sent to the student's notification inbox",
  "Chưa có tin nhắn nào được gửi cho sinh viên này.":
    "No messages have been sent to this student.",
  "Đã gửi, chưa đọc": "Sent, unread",
  "Nội dung nhắc nhở": "Reminder content",
  "Nhập nội dung gửi trực tiếp đến sinh viên...":
    "Enter a message to send directly to the student...",
  "Gửi đến": "Send to",
  "/5000 ký tự": "/5,000 characters",
  "Vui lòng nhập nội dung cần gửi cho sinh viên.":
    "Please enter a message for the student.",
  "Không thể gửi tin nhắn.": "Unable to send the message.",
  "Không thể tải cuộc trao đổi.": "Unable to load the conversation.",
  "Không thể tải dữ liệu nhắc nhở.": "Unable to load reminder data.",
  "Em đang có": "You currently have",
  "báo cáo quá hạn chưa nộp. Em cần kiểm tra và hoàn thành sớm, sau đó phản hồi lại cho thầy/cô.":
    "overdue reports that have not been submitted. Please review and complete them soon, then reply to your lecturer.",
  "Tiến độ thực tập của em đang cần được chú ý. Em hãy rà soát công việc và chủ động phản hồi kế hoạch khắc phục cho thầy/cô.":
    "Your internship progress requires attention. Please review your work and proactively share a recovery plan with your lecturer.",
  "Em vui lòng kiểm tra tiến độ thực tập và các báo cáo cần hoàn thành. Nếu có khó khăn, hãy chủ động phản hồi để thầy/cô hỗ trợ.":
    "Please review your internship progress and required reports. If you have difficulties, contact your lecturer for support.",
  "Chào em, thầy/cô muốn trao đổi thêm về tình hình thực tập hiện tại của em.":
    "Hello, your lecturer would like to discuss your current internship status.",

  // Add/edit student workflows and remaining student detail labels.
  "Chọn một sinh viên đã có tài khoản trong hệ thống và thêm sinh viên đó vào danh sách thực tập bạn đang hướng dẫn.":
    "Select an existing student account and add that student to your supervised internship list.",
  "Đang tải danh sách sinh viên, học kỳ và doanh nghiệp...":
    "Loading students, semesters, and companies...",
  "Chỉ hiển thị sinh viên chưa nằm trong danh sách hướng dẫn hiện tại của bạn.":
    "Only students who are not currently on your supervision list are shown.",
  "-- Chọn sinh viên --": "-- Select student --",
  "-- Chưa chọn doanh nghiệp --": "-- No company selected --",
  "Học kỳ": "Semester",
  "Lớp": "Class",
  "Thông tin này sẽ tạo bản ghi trong bảng internships và liên kết sinh viên với giảng viên.":
    "This will create an internship record and link the student to the lecturer.",
  "Trạng thái ban đầu": "Initial status",
  "Đang thêm sinh viên vào": "Adding student to",
  "Đang thêm...": "Adding...",
  "Bạn chưa chọn sinh viên.": "Please select a student.",
  "Đã thêm sinh viên vào danh sách của bạn.":
    "The student was added to your list.",
  "Không thể tải dữ liệu biểu mẫu.": "Unable to load form data.",
  "Không thể thêm sinh viên.": "Unable to add the student.",
  "Chưa có lịch báo cáo": "No reporting schedule",
  "Đã nộp đúng hạn": "Submitted on time",
  "Không tìm thấy sinh viên thuộc quyền hướng dẫn của giảng viên.":
    "No student under this lecturer's supervision was found.",
  "trên": "out of",
  "Báo cáo": "Reports",
  "Báo cáo giữa kỳ": "Midterm report",
  "Báo cáo cuối kỳ": "Final report",
  "Báo cáo phản ánh": "Reflection report",
  "đợt thực tập": "internship periods",
  "sinh viên": "students",
  "Tin nhắn": "Messages",
  "Không thể tải chi tiết sinh viên.": "Unable to load student details.",
  "Không thể tải thông tin đợt thực tập.":
    "Unable to load internship period information.",
  "Không tìm thấy tài khoản giảng viên.": "Lecturer account not found.",
  "Kiểm tra DATABASE_URL và UUID giảng viên trên đường dẫn.":
    "Check DATABASE_URL and the lecturer UUID in the URL.",
  "Không thể mở tệp (": "Unable to open the file (",
  "Trạng thái báo cáo không hợp lệ.": "Invalid report status.",
  "Trạng thái thực tập không hợp lệ.": "Invalid internship status.",
  "Đang tải dữ liệu thật từ PostgreSQL...":
    "Loading live data from PostgreSQL...",

  // Messages and default labels returned by lecturer API endpoints.
  "Sinh viên không thuộc quyền hướng dẫn.":
    "The student is not under your supervision.",
  "Sinh viên chưa có ": "The student does not have an ",
  "kỳ thực tập.": "internship yet.",
  "Không tìm thấy giảng viên đang hoạt động.":
    "No active lecturer account was found.",
  "Sinh viên không tồn tại hoặc tài khoản đã bị khóa.":
    "The student does not exist or the account has been locked.",
  "Học kỳ không tồn tại hoặc không còn hoạt động.":
    "The semester does not exist or is no longer active.",
  "Doanh nghiệp không tồn tại hoặc không còn hoạt động.":
    "The company does not exist or is no longer active.",
  "Sinh viên này đã có trong danh sách của bạn ở học kỳ đã chọn.":
    "This student is already on your list for the selected semester.",
  "Sinh viên này đã được phân cho giảng viên khác trong học kỳ đã chọn.":
    "This student is assigned to another lecturer for the selected semester.",
  "Không thể tạo bản ghi thực tập.": "Unable to create the internship record.",
  "Đã thêm ": "Added ",
  " vào danh sách sinh viên của bạn.": " to your student list.",
  "Không tìm thấy sinh viên thuộc quyền hướng dẫn của bạn.":
    "No student under your supervision was found.",
  "Sinh viên đã có một kỳ thực tập khác trong học kỳ này.":
    "The student already has another internship in this semester.",
  "Sinh viên đã được phân cho giảng viên khác trong học kỳ này.":
    "The student is assigned to another lecturer in this semester.",
  "Vị trí thực tập không được để trống.":
    "The internship position is required.",
  "Không tìm thấy hồ sơ học tập của sinh viên.":
    "The student's academic profile was not found.",
  "Không thể cập nhật thông tin thực tập.":
    "Unable to update internship information.",
  "Đã cập nhật thông tin sinh viên thành công.":
    "Student information updated successfully.",
  "Tên đợt, mã học kỳ và năm học không được để trống.":
    "The period name, semester code, and academic year are required.",
  "Mã học kỳ đã được sử dụng cho một đợt khác.":
    "The semester code is already used by another period.",
  "Không tìm thấy đợt thực tập cần cập nhật.":
    "The internship period to update was not found.",
  "Đã cập nhật đợt thực tập thành công.":
    "Internship period updated successfully.",
  "Đã tạo đợt thực tập thành công.":
    "Internship period created successfully.",
  "Chỉ hỗ trợ JPG, PNG hoặc WEBP.":
    "Only JPG, PNG, or WEBP images are supported.",
  "Ảnh tải lên bị rỗng.": "The uploaded image is empty.",
  "Ảnh không được vượt quá 5MB.": "The image must not exceed 5 MB.",
  "Chưa có ảnh đại diện.": "No profile picture is available.",
  "Loại đánh giá không hợp lệ.": "Invalid evaluation type.",
  "Không tìm thấy kỳ thực tập thuộc quyền đánh giá của bạn.":
    "No internship under your evaluation authority was found.",
  "Có ": "There are ",
  " báo cáo quá hạn chưa nộp.": " overdue reports that have not been submitted.",
  " báo cáo được nộp muộn.": " reports submitted late.",
  "Tiến độ thực tập chưa đạt 100% cho đánh giá cuối kỳ.":
    "Internship progress has not reached 100% for the final evaluation.",
  "Chưa có báo cáo để làm căn cứ đánh giá.":
    "No reports are available as evaluation evidence.",
  "Vui lòng nhập điểm mạnh và nội dung cần cải thiện trước khi xác nhận.":
    "Enter strengths and areas for improvement before confirming.",
  "Đánh giá đã được xác nhận và không thể chỉnh sửa.":
    "The evaluation has been confirmed and cannot be edited.",
  "Đánh giá đã nộp không thể chuyển lại thành bản nháp.":
    "A submitted evaluation cannot be changed back to a draft.",
  "giữa kỳ": "midterm",
  "cuối kỳ": "final",
  "đã được xác nhận": "has been confirmed",
  "đã được nộp": "has been submitted",
  "Đánh giá ": "Evaluation ",
  " của bạn ": " has ",
  "Đã lưu bản nháp đánh giá.": "Evaluation draft saved.",
  "Đã nộp đánh giá cho sinh viên.":
    "The evaluation was submitted for the student.",
  "Đã xác nhận kết quả đánh giá.": "Evaluation result confirmed.",
  "Mã giảng viên đã được sử dụng.": "The lecturer ID is already in use.",
  "Không tìm thấy tài liệu của hồ sơ.": "Application document not found.",
  "Không tìm thấy thông báo.": "Notification not found.",
  "Báo cáo chưa có file đính kèm.": "The report has no attached file.",
  "Không tìm thấy hồ sơ thuộc quyền xét duyệt của bạn.":
    "No application under your review authority was found.",
  "Hồ sơ đã có kết quả và không thể xét duyệt lại.":
    "The application already has a decision and cannot be reviewed again.",
  "Hồ sơ chưa có đợt thực tập để phê duyệt.":
    "The application has no internship period to approve.",
  "Hồ sơ chưa có vị trí thực tập.":
    "The application has no internship position.",
  "Sinh viên đã có kỳ thực tập khác trong cùng đợt này.":
    "The student already has another internship in this period.",
  "Hồ sơ đang được xem xét": "Application under review",
  "Giảng viên đã bắt đầu xem xét hồ sơ đăng ký thực tập của bạn.":
    "The lecturer has started reviewing your internship application.",
  "Hồ sơ đã được duyệt": "Application approved",
  "Hồ sơ đăng ký thực tập của bạn đã được giảng viên phê duyệt.":
    "Your internship application has been approved by the lecturer.",
  "Hồ sơ chưa được chấp thuận": "Application not approved",
  "Đã cập nhật kết quả xét duyệt hồ sơ.":
    "Application review decision updated.",
  "Không tìm thấy báo cáo thuộc quyền hướng dẫn của bạn.":
    "No report under your supervision was found.",
  "Vui lòng nhập phản hồi khi yêu cầu sinh viên chỉnh sửa.":
    "Enter feedback when requesting a student revision.",
  "Vui lòng nhập điểm trước khi duyệt báo cáo.":
    "Enter a score before approving the report.",
  "Không tìm thấy báo cáo đã nộp thuộc quyền chấm của bạn.":
    "No submitted report under your grading authority was found.",
  "Báo cáo của bạn đã được giảng viên duyệt.":
    "Your report has been approved by the lecturer.",
  "Giảng viên yêu cầu bạn chỉnh sửa và nộp lại báo cáo.":
    "The lecturer asked you to revise and resubmit the report.",
  "Báo cáo đã được duyệt": "Report approved",
  "Báo cáo cần chỉnh sửa": "Report requires revision",
  "Đã cập nhật đánh giá báo cáo.": "Report evaluation updated.",
  "Nội dung trao đổi không được để trống.":
    "The message content is required.",
  "Bình luận được trả lời không tồn tại.":
    "The comment being replied to does not exist.",
  "Giảng viên phản hồi báo cáo": "Lecturer report feedback",
  "Không tìm thấy sinh viên thuộc quyền phụ trách của bạn.":
    "No student under your responsibility was found.",
  "Tiến độ thấp hơn kế hoạch": "Progress below plan",
  "Tiến độ hiện tại là ": "Current progress is ",
  "thấp hơn mốc dự kiến của kỳ thực tập.":
    "below the expected internship milestone.",
  "Quá hạn ": "Overdue ",
  "Sinh viên chưa nộp báo cáo theo lịch yêu cầu.":
    "The student has not submitted the report according to schedule.",
  "Báo cáo nộp muộn": "Late report submission",
  "Báo cáo thực tập được nộp sau hạn.":
    "The internship report was submitted after the deadline.",
  "Nội dung tin nhắn không được để trống.": "The message content is required.",
};

const translationEntries = Object.entries({
  ...VI_TO_EN,
  ...STUDENT_PORTAL_VI_TO_EN,
  ...LECTURER_PORTAL_VI_TO_EN,
})
  .sort(([first], [second]) => second.length - first.length);
const originalText = new WeakMap<Text, string>();
const lastAppliedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const lastAppliedAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["placeholder", "title", "aria-label"];
let currentLocale: UiLocale = "vi";
let observer: MutationObserver | null = null;
let updateQueued = false;
let nativeAlert: typeof window.alert | null = null;
let nativeConfirm: typeof window.confirm | null = null;

function translateText(value: string): string {
  let result = value;
  for (const [vietnamese, english] of translationEntries) {
    result = result.replaceAll(vietnamese, english);
  }

  result = result
    .replace(/Đã quá hạn (\d+) ngày/g, "$1 days overdue")
    .replace(/Quá hạn (\d+) ngày/g, "$1 days overdue")
    .replace(/Còn (\d+) ngày/g, "$1 days remaining")
    .replace(/Còn (\d+) giờ/g, "$1 hours remaining")
    .replace(/Còn (\d+) phút/g, "$1 minutes remaining")
    .replace(/Đến hạn (\d+) giờ trước/g, "Due $1 hours ago")
    .replace(/Đến hạn (\d+) phút trước/g, "Due $1 minutes ago")
    .replace(/(\d+) tín chỉ/g, "$1 credits")
    .replace(/Bạn còn thiếu (\d+) tài liệu để hoàn tất hồ sơ thực tập\./g,
      "$1 documents are still required to complete your internship profile.");

  return result;
}

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest(
    ".notranslate, [translate='no'], script, style, code, pre, textarea",
  ));
}

function shouldSkipAttributes(element: Element): boolean {
  return Boolean(element.closest(
    ".notranslate, [translate='no'], script, style, code, pre",
  ));
}

function updateTextNode(node: Text) {
  if (shouldSkip(node.parentElement)) return;

  const currentValue = node.nodeValue ?? "";
  const lastApplied = lastAppliedText.get(node);
  if (!originalText.has(node) || (
    lastApplied !== undefined && currentValue !== lastApplied
  )) {
    originalText.set(node, currentValue);
  }
  const source = originalText.get(node) ?? "";
  const nextValue = currentLocale === "en" ? translateText(source) : source;
  if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  lastAppliedText.set(node, nextValue);
}

function updateElementAttributes(element: Element) {
  // Text typed inside a textarea must never be translated, but its
  // placeholder/title/aria-label are still part of the application UI.
  if (shouldSkipAttributes(element)) return;
  let saved = originalAttributes.get(element);
  if (!saved) {
    saved = new Map<string, string>();
    originalAttributes.set(element, saved);
  }
  let applied = lastAppliedAttributes.get(element);
  if (!applied) {
    applied = new Map<string, string>();
    lastAppliedAttributes.set(element, applied);
  }

  for (const attribute of translatedAttributes) {
    const value = element.getAttribute(attribute);
    if (value === null) continue;
    const lastApplied = applied.get(attribute);
    if (!saved.has(attribute) || (
      lastApplied !== undefined && value !== lastApplied
    )) {
      saved.set(attribute, value);
    }
    const source = saved.get(attribute) ?? value;
    const nextValue = currentLocale === "en" ? translateText(source) : source;
    if (value !== nextValue) element.setAttribute(attribute, nextValue);
    applied.set(attribute, nextValue);
  }
}

function updateSubtree(root: ParentNode) {
  if (root instanceof Element) updateElementAttributes(root);

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textWalker.nextNode();
  while (textNode) {
    updateTextNode(textNode as Text);
    textNode = textWalker.nextNode();
  }

  if (root instanceof Element || root instanceof Document) {
    root.querySelectorAll("[placeholder], [title], [aria-label]")
      .forEach(updateElementAttributes);
  }
}

function queueDocumentUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  window.requestAnimationFrame(() => {
    updateQueued = false;
    if (document.body) updateSubtree(document.body);
  });
}

function updateBrowserDialogs() {
  if (!nativeAlert) nativeAlert = window.alert.bind(window);
  if (!nativeConfirm) nativeConfirm = window.confirm.bind(window);

  window.alert = (message?: unknown) => nativeAlert?.(
    currentLocale === "en" ? translateText(String(message ?? "")) : message,
  );
  window.confirm = (message?: string) => nativeConfirm?.(
    currentLocale === "en" ? translateText(message ?? "") : message,
  ) ?? false;
}

export function applyLocalUiLanguage(locale: UiLocale) {
  currentLocale = locale;
  if (!document.body) return;
  updateBrowserDialogs();
  updateSubtree(document.body);

  if (!observer) {
    observer = new MutationObserver(queueDocumentUpdate);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: translatedAttributes,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }
}
