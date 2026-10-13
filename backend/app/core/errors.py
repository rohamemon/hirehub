"""Consistent error responses: {"error": {"code", "message", "details"}}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("hirehub")


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, details=None):
        self.message = message
        if code:
            self.code = code
        self.details = details


class NotFound(AppError):
    status_code, code = 404, "not_found"


class Forbidden(AppError):
    status_code, code = 403, "forbidden"


class Unauthorized(AppError):
    status_code, code = 401, "unauthorized"


class Conflict(AppError):
    status_code, code = 409, "conflict"


class TooManyRequests(AppError):
    status_code, code = 429, "rate_limited"


def _body(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(_body(exc.code, exc.message, exc.details), exc.status_code, headers=headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(_body("http_error", str(exc.detail)), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(_body("validation_error", "Invalid input", details), 422)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        # Log full trace server-side; never leak it to the client.
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(_body("internal_error", "Something went wrong"), 500)
