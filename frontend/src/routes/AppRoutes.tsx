import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Spinner } from "@/components/ui/Feedback";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from "@/pages/AuthPages";
import { CompaniesPage, CompanyDetailPage } from "@/pages/CompaniesPage";
import HomePage from "@/pages/HomePage";
import JobDetailPage from "@/pages/JobDetailPage";
import JobsPage from "@/pages/JobsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import { AboutPage, ContactPage, NotFoundPage, PrivacyPage, TermsPage } from "@/pages/StaticPages";
import { ProtectedRoute } from "./ProtectedRoute";

// Dashboards are code-split so public visitors don't download charts and admin screens.
const named = <T extends Record<string, React.ComponentType>>(load: () => Promise<T>, key: keyof T & string) =>
  lazy(() => load().then((m) => ({ default: m[key] })));
const admin = () => import("@/pages/admin/AdminPages");
const employer = () => import("@/pages/employer/EmployerPages");
const student = () => import("@/pages/student/StudentPages");
const AdminOverview = named(admin, "AdminOverview"), AdminUsers = named(admin, "AdminUsers"), AdminJobs = named(admin, "AdminJobs");
const AdminReports = named(admin, "AdminReports"), AdminCategories = named(admin, "AdminCategories"), AdminAudit = named(admin, "AdminAudit");
const EmployerOverview = named(employer, "EmployerOverview"), EmployerJobs = named(employer, "EmployerJobs"), EmployerJobForm = named(employer, "EmployerJobForm");
const EmployerApplicants = named(employer, "EmployerApplicants"), EmployerCompany = named(employer, "EmployerCompany");
const StudentOverview = named(student, "StudentOverview"), StudentApplications = named(student, "StudentApplications");
const SavedJobsPage = named(student, "SavedJobsPage"), StudentProfilePage = named(student, "StudentProfilePage");

export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:slug" element={<CompanyDetailPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />

      <Route element={<ProtectedRoute roles={["student"]} />}>
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<StudentOverview />} />
          <Route path="applications" element={<StudentApplications />} />
          <Route path="saved" element={<SavedJobsPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["employer"]} />}>
        <Route path="employer" element={<DashboardLayout />}>
          <Route index element={<EmployerOverview />} />
          <Route path="jobs" element={<EmployerJobs />} />
          <Route path="jobs/new" element={<EmployerJobForm />} />
          <Route path="jobs/:id" element={<EmployerJobForm />} />
          <Route path="applicants" element={<EmployerApplicants />} />
          <Route path="company" element={<EmployerCompany />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="admin" element={<DashboardLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
