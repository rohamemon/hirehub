import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, GraduationCap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FormError, Spinner } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Form";
import { homeFor, useAuth } from "@/features/auth/AuthContext";
import { forgotSchema, loginSchema, registerSchema, resetSchema, type LoginForm, type RegisterForm } from "@/features/auth/schemas";
import { useSeo } from "@/hooks/useSeo";
import { ApiError, post } from "@/services/api";
import { Logo } from "@/layouts/PublicLayout";

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10">
      <Logo />
      <main id="main" className="card mt-8 w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

/** Applies server-side field errors (e.g. "email already exists") to the form. */
const serverFieldError = (e: unknown, field: string): string | undefined =>
  e instanceof ApiError ? e.details?.find((d) => d.field === field)?.message : undefined;

export function LoginPage() {
  useSeo({ title: "Log in", noindex: true });
  const { user, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (user) return <Navigate to={from ?? homeFor(user.role)} replace />;
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try { const u = await login(v.email, v.password); nav(from ?? homeFor(u.role), { replace: true }); } catch (e) { setError(e); }
  });
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your HireHub account">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <FormError error={error} />
        <Button type="submit" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
        <Link to="/register" className="text-brand-600 hover:underline">Create account</Link>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  useSeo({ title: "Create your account", noindex: true });
  const { user, register: signUp } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, watch, setValue, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema), defaultValues: { role: params.get("role") === "employer" ? "employer" : "student" },
  });
  const role = watch("role");

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const u = await signUp({ ...v, company_name: v.role === "employer" ? v.company_name : undefined });
      nav(homeFor(u.role), { replace: true });
    } catch (e) {
      const msg = serverFieldError(e, "email");
      if (e instanceof ApiError && e.code === "email_taken") setFieldError("email", { message: e.message });
      else if (msg) setFieldError("email", { message: msg });
      else setError(e);
    }
  });

  const roleBtn = (value: "student" | "employer", label: string, Icon: typeof GraduationCap, desc: string) => (
    <button type="button" role="radio" aria-checked={role === value} onClick={() => setValue("role", value)}
      className={`flex flex-1 flex-col items-start gap-1 rounded-lg border p-3 text-left ${role === value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-300 hover:bg-slate-50"}`}>
      <Icon className="h-5 w-5 text-brand-600" aria-hidden /><span className="text-sm font-semibold">{label}</span><span className="text-xs text-slate-500">{desc}</span>
    </button>
  );

  return (
    <AuthShell title="Create your account" subtitle="Join HireHub in under two minutes">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div role="radiogroup" aria-label="I am a" className="flex gap-3">
          {roleBtn("student", "Student / job seeker", GraduationCap, "Find jobs and internships")}
          {roleBtn("employer", "Employer", Briefcase, "Hire emerging talent")}
        </div>
        <Input label="Full name" autoComplete="name" error={errors.full_name?.message} {...register("full_name")} />
        {role === "employer" && <Input label="Company name" autoComplete="organization" error={errors.company_name?.message} {...register("company_name")} />}
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number." error={errors.password?.message} {...register("password")} />
        <FormError error={error} />
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
        <p className="text-xs text-slate-500">By signing up you agree to our <Link className="underline" to="/terms">Terms</Link> and <Link className="underline" to="/privacy">Privacy Policy</Link>.</p>
      </form>
      <p className="mt-4 text-center text-sm">Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  useSeo({ title: "Forgot password", noindex: true });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try { await post("/auth/forgot-password", v); setDone(true); } catch (e) { setError(e); }
  });
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {done ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">If that email is registered, a reset link is on its way. Check your inbox.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <FormError error={error} />
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 hover:underline">Back to log in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  useSeo({ title: "Choose a new password", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(resetSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try { await post("/auth/reset-password", { token, password: v.password }); setDone(true); } catch (e) { setError(e); }
  });
  return (
    <AuthShell title="Choose a new password">
      {!token ? <p role="alert" className="text-sm text-red-700">This reset link is missing its token. Request a new one.</p> : done ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Password updated. <Link className="font-medium underline" to="/login">Log in</Link></p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          <FormError error={error} />
          <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  useSeo({ title: "Verify email", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  useEffect(() => {
    if (!token) return;
    post("/auth/verify-email", { token }).then(() => setState("ok")).catch(() => setState("error"));
  }, [token]);
  return (
    <AuthShell title="Email verification">
      {state === "loading" ? <Spinner label="Verifying" /> : state === "ok" ? (
        <p role="status" className="text-sm text-emerald-800">Your email is verified. <Link className="font-medium underline" to="/login">Continue</Link></p>
      ) : <p role="alert" className="text-sm text-red-700">This verification link is invalid or has expired. Log in and request a new one.</p>}
    </AuthShell>
  );
}
