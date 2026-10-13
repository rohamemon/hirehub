from fastapi import APIRouter

from app.api.v1.endpoints import admin, applications, auth, companies, employer, jobs, notifications, students

api_router = APIRouter()
for module in (auth, students, jobs, employer, applications, companies, notifications, admin):
    api_router.include_router(module.router)
