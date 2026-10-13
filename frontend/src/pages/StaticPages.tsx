import { useState, type FormEvent, type ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Form";
import { useSeo } from "@/hooks/useSeo";

function Doc({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  useSeo({ title, description, canonicalPath: path });
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </div>
  );
}

export const AboutPage = () => (
  <Doc title="About HireHub" path="/about" description="HireHub helps students and graduates find their first jobs and internships.">
    <p>HireHub is a job and internship platform that connects students and early-career job seekers with employers who want to hire emerging talent.</p>
    <p>We believe the first step into a career should be simple: build one profile, upload one CV, and apply to roles that fit, while employers get a clear, organised view of every candidate.</p>
    <h2>For candidates</h2><p>Search by keyword, location, type and salary, save roles for later, and follow each application's status in your dashboard.</p>
    <h2>For employers</h2><p>Publish vacancies, review applicants, move them through your pipeline and see how your listings perform.</p>
    <p className="pt-4"><LinkButton to="/jobs">Browse jobs</LinkButton></p>
  </Doc>
);

export const PrivacyPage = () => (
  <Doc title="Privacy Policy" path="/privacy" description="How HireHub collects, uses and protects your personal data.">
    <p><em>Template for a portfolio project. Have a lawyer review it before using it with real users.</em></p>
    <h2>Data we collect</h2>
    <ul><li>Account details: name, email and a securely hashed password.</li><li>Profile information you choose to add, including your CV.</li><li>Application activity and basic security logs.</li></ul>
    <h2>How we use it</h2><p>To operate the service: showing your profile and CV to employers you apply to, sending notifications, and keeping the platform safe.</p>
    <h2>Who can see your CV</h2><p>Only you, the employer of a job you applied to, and platform administrators handling moderation or support.</p>
    <h2>Your rights</h2><p>You can update your profile at any time and ask us to delete your account and data by contacting us.</p>
  </Doc>
);

export const TermsPage = () => (
  <Doc title="Terms and Conditions" path="/terms" description="The terms for using the HireHub platform.">
    <p><em>Template for a portfolio project. Have a lawyer review it before using it with real users.</em></p>
    <h2>Using HireHub</h2><p>You must provide accurate information and keep your credentials secure. Accounts used for fraud, spam or discrimination may be disabled.</p>
    <h2>Job listings</h2><p>Employers are responsible for the accuracy and lawfulness of their listings. We may remove listings that breach these terms.</p>
    <h2>Liability</h2><p>HireHub connects candidates and employers but is not a party to any employment relationship.</p>
  </Doc>
);

export function ContactPage() {
  const [sent, setSent] = useState(false);
  // The platform has no mail inbox wired up, so this form opens the user's email client instead of pretending to send.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = encodeURIComponent(`${f.get("message")}\n\nFrom: ${f.get("name")} (${f.get("email")})`);
    window.location.href = `mailto:hello@hirehub.example?subject=${encodeURIComponent("HireHub enquiry")}&body=${body}`;
    setSent(true);
  };
  return (
    <Doc title="Contact us" path="/contact" description="Get in touch with the HireHub team.">
      <p>Questions or feedback? Email <a className="text-brand-600 underline" href="mailto:hello@hirehub.example">hello@hirehub.example</a> or use the form below to open your email app.</p>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <Input label="Your name" name="name" required />
        <Input label="Email" name="email" type="email" required />
        <Textarea label="Message" name="message" rows={5} required />
        <Button type="submit">Write email</Button>
        {sent && <p role="status" className="text-xs text-slate-500">Your email app should have opened with the message ready to send.</p>}
      </form>
    </Doc>
  );
}

export function NotFoundPage() {
  useSeo({ title: "Page not found", noindex: true });
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you're looking for doesn't exist or has moved.</p>
      <div className="mt-6 flex gap-3"><LinkButton to="/">Go home</LinkButton><LinkButton to="/jobs" variant="secondary">Browse jobs</LinkButton></div>
    </div>
  );
}
