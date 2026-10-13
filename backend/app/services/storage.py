"""Private file storage with strict validation.

Files are written to UPLOAD_DIR (not a static/public directory) under random names.
Type is decided from file *content* (magic bytes), never from the client's filename
or Content-Type. Downloads go through an authorized API endpoint.
"""
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from fastapi import UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import FileKind, UploadedFile, User

SIGNATURES = {
    "application/pdf": (b"%PDF-", ".pdf"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
}
ALLOWED = {
    FileKind.cv: {"application/pdf"},
    FileKind.logo: {"image/png", "image/jpeg"},
    FileKind.avatar: {"image/png", "image/jpeg"},
}


def _root() -> Path:
    root = get_settings().upload_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _sniff(head: bytes) -> str | None:
    for mime, (sig, _) in SIGNATURES.items():
        if head.startswith(sig):
            return mime
    return None


def save_upload(db: Session, owner: User, kind: FileKind, upload: UploadFile) -> UploadedFile:
    s = get_settings()
    limit = s.max_cv_bytes if kind == FileKind.cv else s.max_image_bytes
    data = upload.file.read(limit + 1)
    if not data:
        raise AppError("The uploaded file is empty", code="invalid_file")
    if len(data) > limit:
        raise AppError(f"File too large (max {limit // (1024 * 1024)} MB)", code="file_too_large")
    mime = _sniff(data[:16])
    if mime is None or mime not in ALLOWED[kind]:
        allowed = "PDF" if kind == FileKind.cv else "PNG or JPEG"
        raise AppError(f"Invalid file type. Only {allowed} files are accepted.", code="invalid_file_type")

    stored = f"{uuid.uuid4().hex}{SIGNATURES[mime][1]}"
    _write(stored, data, mime)
    original = Path(upload.filename or "file").name[:200]  # basename only, for display
    record = UploadedFile(owner_id=owner.id, kind=kind.value, original_name=original,
                          stored_name=stored, content_type=mime, size_bytes=len(data))
    db.add(record)
    db.flush()
    return record


def _use_s3() -> bool:
    return get_settings().storage_backend == "s3"


@lru_cache
def _s3():
    import boto3  # imported lazily so local development doesn't need it

    s = get_settings()
    return boto3.client("s3", endpoint_url=s.s3_endpoint_url or None, region_name=s.s3_region,
                        aws_access_key_id=s.s3_access_key, aws_secret_access_key=s.s3_secret_key)


def _write(name: str, data: bytes, mime: str) -> None:
    if _use_s3():
        _s3().put_object(Bucket=get_settings().s3_bucket, Key=name, Body=data, ContentType=mime)
    else:
        (_root() / name).write_bytes(data)


def file_path(record: UploadedFile) -> Path:
    path = (_root() / record.stored_name).resolve()
    if _root() not in path.parents:  # defence in depth against path traversal
        raise AppError("Invalid file path")
    return path


def file_response(record: UploadedFile, headers: dict[str, str], download_name: str | None = None) -> Response:
    """Serve a stored file from whichever backend is configured. Authorization happens in the caller."""
    if not _use_s3():
        return FileResponse(file_path(record), media_type=record.content_type, filename=download_name, headers=headers)
    try:
        body = _s3().get_object(Bucket=get_settings().s3_bucket, Key=record.stored_name)["Body"].read()
    except Exception:
        raise AppError("File not available", code="file_missing")
    headers = dict(headers)
    if download_name:
        headers["Content-Disposition"] = f"attachment; filename*=utf-8''{quote(download_name)}"
    return Response(body, media_type=record.content_type, headers=headers)


def delete_file(db: Session, record: UploadedFile | None) -> None:
    if record is None:
        return
    try:
        if _use_s3():
            _s3().delete_object(Bucket=get_settings().s3_bucket, Key=record.stored_name)
        else:
            file_path(record).unlink(missing_ok=True)
    except Exception:
        pass  # a missing/undeletable object must not block the DB change
    db.delete(record)
