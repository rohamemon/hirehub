export type Role = "student" | "employer" | "admin";
export type ApplicationStatus =
  | "pending" | "reviewed" | "shortlisted" | "interview" | "accepted" | "rejected" | "withdrawn";
export type JobStatus = "draft" | "published" | "closed" | "removed";
export type EmploymentType = "full_time" | "part_time" | "internship" | "contract" | "temporary";
export type ExperienceLevel = "entry" | "junior" | "mid" | "senior";
export type WorkplaceType = "remote" | "hybrid" | "on_site";

export interface User {
  id: string; email: string; full_name: string; role: Role;
  is_active: boolean; email_verified: boolean; created_at: string; company_id: string | null;
}
export interface Page<T> { items: T[]; total: number; page: number; page_size: number; pages: number }
export interface Category { id: string; name: string; slug: string; icon: string | null }
export interface CompanyBrief { id: string; name: string; slug: string; location: string | null; has_logo: boolean }
export interface Company extends CompanyBrief {
  description: string | null; website: string | null; industry: string | null; size: string | null; open_jobs: number;
}
export interface JobListItem {
  id: string; title: string; employment_type: EmploymentType; experience_level: ExperienceLevel;
  workplace_type: WorkplaceType; location: string | null; salary_min: number | null; salary_max: number | null;
  salary_currency: string; deadline: string | null; status: JobStatus; published_at: string | null;
  created_at: string; company: CompanyBrief; category: Category | null; skills: string[];
  is_saved: boolean; application_count: number | null;
}
export interface Job extends JobListItem {
  description: string; responsibilities: string | null; requirements: string | null;
  updated_at: string; is_open: boolean; has_applied: boolean;
}
export interface JobInput {
  title: string; description: string; responsibilities?: string | null; requirements?: string | null;
  skills: string[]; category_id?: string | null; employment_type: EmploymentType;
  experience_level: ExperienceLevel; workplace_type: WorkplaceType; location?: string | null;
  salary_min?: number | null; salary_max?: number | null; salary_currency: string; deadline?: string | null;
}
export interface StudentProfile {
  user_id: string; full_name: string; email: string; headline: string | null; bio: string | null;
  phone: string | null; location: string | null; education: string | null; experience: string | null;
  skills: string[]; portfolio_url: string | null; github_url: string | null; linkedin_url: string | null;
  cv_filename: string | null; has_avatar: boolean;
}
export interface Application {
  id: string; status: ApplicationStatus; cover_letter: string | null; has_cv: boolean;
  created_at: string; updated_at: string; job: JobListItem;
}
export interface Applicant extends Application {
  student: Omit<StudentProfile, "phone" | "cv_filename">;
  history: { from_status: string | null; to_status: string; created_at: string }[];
}
export interface AppNotification {
  id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string;
}
export interface StudentStats {
  total_applications: number; pending: number; shortlisted: number; saved_jobs: number;
  by_status: Record<string, number>;
}
export interface EmployerStats {
  total_jobs: number; published_jobs: number; active_vacancies: number; total_applications: number;
  by_status: Record<string, number>; trend: { date: string; applications: number }[];
}
export interface AuditEntry {
  id: string; action: string; entity_type: string | null; entity_id: string | null;
  detail: Record<string, unknown> | null; created_at: string; actor_email: string | null;
}
export interface AdminStats {
  total_users: number; students: number; employers: number; admins: number; companies: number;
  total_jobs: number; published_jobs: number; closed_jobs: number; total_applications: number;
  open_reports: number; recent_activity: AuditEntry[];
}
export interface Report {
  id: string; reason: string; details: string | null; status: string; created_at: string; job: JobListItem;
}
