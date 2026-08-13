import os
from collections.abc import Iterable

DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024
DEFAULT_CORS_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


def get_max_pdf_bytes() -> int:
    raw = os.getenv("MAX_PDF_BYTES", str(DEFAULT_MAX_PDF_BYTES))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError("MAX_PDF_BYTES must be an integer") from exc
    if value <= 0:
        raise RuntimeError("MAX_PDF_BYTES must be positive")
    return value


def get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS")
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError("CORS_ORIGINS must contain at least one origin")
    if "*" in origins:
        raise RuntimeError("Wildcard CORS origins are not allowed")
    return origins


def validate_pdf_metadata(filename: str | None, content_type: str | None) -> None:
    if not filename or not filename.lower().endswith(".pdf"):
        raise ValueError("Apenas arquivos PDF são aceitos.")
    if content_type and content_type.lower() not in PDF_CONTENT_TYPES:
        raise ValueError("Tipo de arquivo inválido; envie um PDF.")


def validate_pdf_signature(data: bytes) -> None:
    if not data.startswith(b"%PDF-"):
        raise ValueError("O arquivo enviado não possui uma assinatura PDF válida.")


async def read_upload_limited(upload, *, max_bytes: int | None = None, chunk_size: int = 64 * 1024) -> bytes:
    limit = get_max_pdf_bytes() if max_bytes is None else max_bytes
    if limit <= 0:
        raise ValueError("Limite de upload inválido.")

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ValueError("PDF excede o tamanho máximo permitido.")
        chunks.append(chunk)

    data = b"".join(chunks)
    validate_pdf_signature(data)
    return data
