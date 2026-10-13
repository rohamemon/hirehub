import logging

from datetime import date

from fastapi import FastAPI, Request
from fastapi.responses import Response
from sqlalchemy import select
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.db.session import engine

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(
    title=f"{settings.app_name} API",
    version="1.0.0",
    description="Job & internship platform API. Auth: Bearer access token; refresh token is an HttpOnly cookie.",
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
install_error_handlers(app)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["meta"])
def health():
    """Liveness + database connectivity, for load balancers and Docker health checks."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    """Dynamic sitemap of public pages. nginx exposes it at the site root."""
    from xml.sax.saxutils import escape

    from app.db.session import SessionLocal
    from app.models import Company, Job

    base = settings.frontend_url.rstrip("/")
    urls = [f"{base}/", f"{base}/jobs", f"{base}/companies", f"{base}/about", f"{base}/contact"]
    with SessionLocal() as db:
        for jid in db.scalars(select(Job.id).where(Job.status == "published", (Job.deadline.is_(None)) | (Job.deadline >= date.today()))):
            urls.append(f"{base}/jobs/{jid}")
        for slug in db.scalars(select(Company.slug)):
            urls.append(f"{base}/companies/{slug}")
    body = "".join(f"<url><loc>{escape(u)}</loc></url>" for u in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(xml, media_type="application/xml")
