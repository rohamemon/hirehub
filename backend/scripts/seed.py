"""Seed data.

    python -m scripts.seed --categories-only   # safe for production: just the category list
    python -m scripts.seed --showcase          # safe for production: fictional companies + open jobs only
    python -m scripts.seed                      # full DEVELOPMENT demo data (refuses in production)

Re-running is safe: it skips anything that already exists. To start over completely
in development: `alembic downgrade base && alembic upgrade head && python -m scripts.seed`.
All people and companies are fictional. Demo password: see DEMO_PASSWORD below
(development only).
"""
import random
import sys
import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password, utcnow
from app.db.session import SessionLocal
from app.models import (
    ApplicationStatusHistory,
    Company,
    EmployerProfile,
    FileKind,
    Job,
    JobApplication,
    JobCategory,
    Notification,
    SavedJob,
    StudentProfile,
    UploadedFile,
    User,
)
from app.services import storage
from app.services.common import slugify

DEMO_PASSWORD = "Demo1234!"  # development only; never used in production

CATEGORIES = [("Software Engineering", "code"), ("Design", "palette"), ("Marketing", "megaphone"),
              ("Data & Analytics", "bar-chart"), ("Finance", "landmark"), ("Sales", "handshake"),
              ("Human Resources", "users"), ("Customer Support", "headphones")]

COMPANIES = [
    ("Nimbus Software", "Cloud tooling for small teams.", "Software", "Berlin"),
    ("Lumen Studio", "A product design studio crafting calm, useful interfaces.", "Design", "Lisbon"),
    ("Harbor Analytics", "Turning messy data into clear decisions.", "Data", "Amsterdam"),
    ("Brightside Finance", "Friendly money tools for first-time investors.", "Finance", "London"),
    ("Kite Marketing", "Growth marketing for independent brands.", "Marketing", "Remote"),
]

STUDENTS = [("Ava Martin", "Computer Science student", "Python, SQL, React"),
            ("Noah Kim", "Aspiring data analyst", "Python, Pandas, Tableau"),
            ("Mia Rossi", "UX design graduate", "Figma, Research, Prototyping"),
            ("Liam Novak", "IT graduate, backend focus", "Python, FastAPI, Docker"),
            ("Zoe Dubois", "Marketing student", "SEO, Copywriting, Analytics"),
            ("Omar Haddad", "Finance & economics graduate", "Excel, Modelling, SQL")]

# (title, company idx, category, type, level, workplace, location, min, max, skills)
JOBS = [
    ("Junior Backend Developer", 0, "Software Engineering", "full_time", "junior", "hybrid", "Berlin", 48000, 60000, ["Python", "FastAPI", "PostgreSQL"]),
    ("Frontend Engineering Intern", 0, "Software Engineering", "internship", "entry", "remote", None, 1200, 1800, ["React", "TypeScript"]),
    ("DevOps Engineer", 0, "Software Engineering", "full_time", "mid", "remote", None, 70000, 90000, ["Docker", "CI/CD", "AWS"]),
    ("QA Automation Intern", 0, "Software Engineering", "internship", "entry", "on_site", "Berlin", 1000, 1500, ["Testing", "Python"]),
    ("Product Designer", 1, "Design", "full_time", "mid", "hybrid", "Lisbon", 45000, 60000, ["Figma", "Design systems"]),
    ("UX Research Intern", 1, "Design", "internship", "entry", "hybrid", "Lisbon", 900, 1200, ["Research", "Interviews"]),
    ("Visual Designer", 1, "Design", "part_time", "junior", "remote", None, 25000, 35000, ["Illustration", "Branding"]),
    ("Junior UI Designer", 1, "Design", "full_time", "entry", "on_site", "Lisbon", 32000, 40000, ["Figma", "CSS"]),
    ("Data Analyst", 2, "Data & Analytics", "full_time", "junior", "hybrid", "Amsterdam", 46000, 58000, ["SQL", "Python", "Tableau"]),
    ("Data Science Intern", 2, "Data & Analytics", "internship", "entry", "on_site", "Amsterdam", 1100, 1600, ["Python", "Statistics"]),
    ("Analytics Engineer", 2, "Data & Analytics", "full_time", "senior", "remote", None, 85000, 105000, ["dbt", "SQL", "Airflow"]),
    ("BI Developer", 2, "Data & Analytics", "contract", "mid", "hybrid", "Amsterdam", 60000, 75000, ["Power BI", "SQL"]),
    ("Financial Analyst", 3, "Finance", "full_time", "junior", "on_site", "London", 42000, 52000, ["Excel", "Modelling"]),
    ("Finance Intern", 3, "Finance", "internship", "entry", "on_site", "London", 1000, 1400, ["Excel", "Accounting"]),
    ("Risk Associate", 3, "Finance", "full_time", "mid", "hybrid", "London", 62000, 78000, ["Risk", "Python"]),
    ("Customer Support Specialist", 3, "Customer Support", "full_time", "entry", "remote", None, 28000, 34000, ["Communication", "Zendesk"]),
    ("Content Marketing Intern", 4, "Marketing", "internship", "entry", "remote", None, 700, 1000, ["Writing", "SEO"]),
    ("Growth Marketer", 4, "Marketing", "full_time", "mid", "remote", None, 50000, 65000, ["SEO", "Analytics", "Paid ads"]),
    ("Social Media Manager", 4, "Marketing", "part_time", "junior", "remote", None, 22000, 30000, ["Social media", "Copywriting"]),
    ("Sales Development Rep", 4, "Sales", "full_time", "entry", "hybrid", "Remote", 35000, 45000, ["Outreach", "CRM"]),
    ("Technical Recruiter", 0, "Human Resources", "full_time", "mid", "hybrid", "Berlin", 52000, 64000, ["Sourcing", "Interviewing"]),
    ("HR Coordinator", 3, "Human Resources", "temporary", "entry", "on_site", "London", 30000, 36000, ["Onboarding", "Admin"]),
    ("Machine Learning Intern", 2, "Data & Analytics", "internship", "entry", "remote", None, 1300, 1900, ["Python", "PyTorch"]),
    ("Senior Full-Stack Engineer", 0, "Software Engineering", "full_time", "senior", "remote", None, 95000, 120000, ["React", "Python", "PostgreSQL"]),
]

MIN_PDF = (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
           b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")


def seed_categories(db) -> dict[str, JobCategory]:
    existing = {c.name: c for c in db.scalars(select(JobCategory))}
    for name, icon in CATEGORIES:
        if name not in existing:
            c = JobCategory(name=name, slug=slugify(name), icon=icon)
            db.add(c)
            existing[name] = c
    db.flush()
    return existing


def seed_demo(db) -> None:
    cats = seed_categories(db)
    if db.scalar(select(User.id).where(User.email == "employer1@example.com")):
        print("Demo data already present - nothing to do.")
        return
    rnd = random.Random(42)
    pw = hash_password(DEMO_PASSWORD)

    companies = []
    for i, (name, desc, industry, loc) in enumerate(COMPANIES, 1):
        c = Company(name=name, slug=slugify(name), description=desc, industry=industry, location=loc,
                    website=f"https://{slugify(name)}.example.com", size="11-50")
        db.add(c)
        db.flush()
        u = User(email=f"employer{i}@example.com", password_hash=pw, full_name=f"Recruiter {i} ({name})",
                 role="employer", email_verified=True)
        db.add(u)
        db.flush()
        db.add(EmployerProfile(user_id=u.id, company_id=c.id, job_title="Talent Lead"))
        companies.append((c, u))

    students = []
    for i, (name, headline, skills) in enumerate(STUDENTS, 1):
        u = User(email=f"student{i}@example.com", password_hash=pw, full_name=name, role="student", email_verified=True)
        db.add(u)
        db.flush()
        stored = f"{uuid.uuid4().hex}.pdf"
        (storage._root() / stored).write_bytes(MIN_PDF)
        f = UploadedFile(owner_id=u.id, kind=FileKind.cv.value, original_name=f"{name.replace(' ', '_')}_CV.pdf",
                         stored_name=stored, content_type="application/pdf", size_bytes=len(MIN_PDF))
        db.add(f)
        db.flush()
        db.add(StudentProfile(user_id=u.id, headline=headline, bio="Motivated and eager to learn.", location="Europe",
                              education="BSc, 2025", skills=[s.strip() for s in skills.split(",")], cv_file_id=f.id))
        students.append((u, f))

    jobs = []
    for n, (title, ci, cat, etype, level, wp, loc, smin, smax, skills) in enumerate(JOBS):
        company, recruiter = companies[ci]
        published = utcnow() - timedelta(days=n + 1)
        j = Job(company_id=company.id, posted_by_id=recruiter.id, category_id=cats[cat].id, title=title,
                description=f"{company.name} is looking for a {title} to join our team. You will work with a friendly, "
                            f"collaborative group on meaningful projects and grow quickly.",
                responsibilities="- Deliver high quality work\n- Collaborate with the team\n- Share knowledge",
                requirements="- Strong communication skills\n- Eagerness to learn\n- Relevant coursework or projects",
                skills=skills, employment_type=etype, experience_level=level, workplace_type=wp, location=loc,
                salary_min=smin, salary_max=smax, salary_currency="EUR",
                deadline=date.today() + timedelta(days=rnd.randint(14, 60)),
                status="published", published_at=published)
        db.add(j)
        jobs.append(j)
    # a draft and a closed listing for demo
    db.add(Job(company_id=companies[0][0].id, posted_by_id=companies[0][1].id, category_id=cats["Software Engineering"].id,
               title="Platform Engineer (draft)", description="Draft listing not yet visible to candidates.",
               skills=["Go"], employment_type="full_time", experience_level="mid", workplace_type="remote", status="draft"))
    db.add(Job(company_id=companies[1][0].id, posted_by_id=companies[1][1].id, category_id=cats["Design"].id,
               title="Design Lead (closed)", description="This role has been filled, thank you to everyone who applied.",
               skills=["Leadership"], employment_type="full_time", experience_level="senior", workplace_type="remote",
               status="closed", published_at=utcnow() - timedelta(days=60)))
    db.flush()

    statuses = ["pending", "pending", "reviewed", "shortlisted", "interview", "accepted", "rejected"]
    chain = {"pending": [], "reviewed": ["reviewed"], "shortlisted": ["reviewed", "shortlisted"],
             "interview": ["reviewed", "shortlisted", "interview"],
             "accepted": ["reviewed", "shortlisted", "interview", "accepted"], "rejected": ["rejected"]}
    for u, f in students:
        for job in rnd.sample(jobs, 4):
            status = rnd.choice(statuses)
            app = JobApplication(job_id=job.id, student_id=u.id, cv_file_id=f.id, status=status,
                                 cover_letter="I'd love to contribute to your team.",
                                 created_at=utcnow() - timedelta(days=rnd.randint(0, 25)))
            app.history.append(ApplicationStatusHistory(from_status=None, to_status="pending", changed_by_id=u.id))
            prev = "pending"
            for s in chain[status]:
                app.history.append(ApplicationStatusHistory(from_status=prev, to_status=s))
                prev = s
            db.add(app)
        for job in rnd.sample(jobs, 3):
            db.add(SavedJob(user_id=u.id, job_id=job.id))
        db.add(Notification(user_id=u.id, title="Welcome to HireHub", body="Complete your profile to stand out.", link="/dashboard/profile"))
    for c, u in companies:
        db.add(Notification(user_id=u.id, title="Welcome to HireHub", body="Post your first vacancy today.", link="/employer/jobs"))
    db.commit()
    print(f"Seeded {len(companies)} companies, {len(students)} students, {len(jobs) + 2} jobs.")
    print(f"Demo logins (development only): student1@example.com / employer1@example.com, password {DEMO_PASSWORD}")


def seed_showcase(db) -> None:
    """Fictional companies and jobs so a fresh public site isn't empty.

    Unlike the full demo seed this creates NO logins anyone could use: the owning employer
    accounts get random passwords that are never shown, and there are no students or applications.
    """
    import secrets

    cats = seed_categories(db)
    if db.scalar(select(Company.id).where(Company.slug == slugify(COMPANIES[0][0]))):
        print("Showcase data already present - nothing to do.")
        return
    rnd = random.Random(7)
    companies = []
    for i, (name, desc, industry, loc) in enumerate(COMPANIES, 1):
        c = Company(name=name, slug=slugify(name), description=desc, industry=industry, location=loc,
                    website=f"https://{slugify(name)}.example.com", size="11-50")
        db.add(c)
        db.flush()
        u = User(email=f"showcase{i}@example.com", password_hash=hash_password(secrets.token_urlsafe(32)),
                 full_name=f"{name} Recruiting", role="employer", is_active=True, email_verified=True)
        db.add(u)
        db.flush()
        db.add(EmployerProfile(user_id=u.id, company_id=c.id, job_title="Talent Lead"))
        companies.append((c, u))
    for n, (title, ci, cat, etype, level, wp, loc, smin, smax, skills) in enumerate(JOBS):
        company, recruiter = companies[ci]
        db.add(Job(company_id=company.id, posted_by_id=recruiter.id, category_id=cats[cat].id, title=title,
                   description=f"{company.name} is looking for a {title} to join our team. You will work with a friendly, "
                               f"collaborative group on meaningful projects and grow quickly.",
                   responsibilities="- Deliver high quality work\n- Collaborate with the team\n- Share knowledge",
                   requirements="- Strong communication skills\n- Eagerness to learn\n- Relevant coursework or projects",
                   skills=skills, employment_type=etype, experience_level=level, workplace_type=wp, location=loc,
                   salary_min=smin, salary_max=smax, salary_currency="EUR",
                   deadline=date.today() + timedelta(days=rnd.randint(60, 120)),
                   status="published", published_at=utcnow() - timedelta(days=n + 1)))
    db.commit()
    print(f"Showcase ready: {len(companies)} fictional companies, {len(JOBS)} jobs (no usable logins created).")


def main() -> None:
    categories_only = "--categories-only" in sys.argv
    if "--showcase" in sys.argv:
        with SessionLocal() as db:
            seed_showcase(db)
        return
    if not categories_only and get_settings().is_production:
        sys.exit("Refusing to load demo data in production. Use --categories-only or --showcase.")
    with SessionLocal() as db:
        if categories_only:
            seed_categories(db)
            db.commit()
            print("Categories ready.")
        else:
            seed_demo(db)


if __name__ == "__main__":
    main()
