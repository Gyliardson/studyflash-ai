import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.request_security import (
    DEFAULT_MAX_PDF_BYTES,
    get_cors_origins,
    get_internal_api_key,
    get_max_pdf_bytes,
    read_upload_limited,
    validate_pdf_metadata,
    validate_pdf_signature,
    verify_internal_api_key,
)


class FakeUpload:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    async def read(self, size: int = -1) -> bytes:
        if self.offset >= len(self.data):
            return b""
        if size < 0:
            size = len(self.data) - self.offset
        chunk = self.data[self.offset:self.offset + size]
        self.offset += len(chunk)
        return chunk


class RequestSecurityTests(unittest.IsolatedAsyncioTestCase):
    def test_default_cors_is_local_and_not_wildcard(self):
        with patch.dict(os.environ, {}, clear=True):
            origins = get_cors_origins()
        self.assertEqual(origins, ["http://localhost:3000", "http://127.0.0.1:3000"])
        self.assertNotIn("*", origins)

    def test_configured_cors_origins_are_trimmed(self):
        with patch.dict(os.environ, {"CORS_ORIGINS": "https://studyflash.example, https://www.studyflash.example"}, clear=True):
            self.assertEqual(
                get_cors_origins(),
                ["https://studyflash.example", "https://www.studyflash.example"],
            )

    def test_wildcard_cors_is_rejected(self):
        with patch.dict(os.environ, {"CORS_ORIGINS": "*"}, clear=True):
            with self.assertRaises(RuntimeError):
                get_cors_origins()

    def test_max_pdf_size_defaults_and_validates_configuration(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(get_max_pdf_bytes(), DEFAULT_MAX_PDF_BYTES)
        with patch.dict(os.environ, {"MAX_PDF_BYTES": "0"}, clear=True):
            with self.assertRaises(RuntimeError):
                get_max_pdf_bytes()
        with patch.dict(os.environ, {"MAX_PDF_BYTES": "invalid"}, clear=True):
            with self.assertRaises(RuntimeError):
                get_max_pdf_bytes()

    def test_internal_api_key_must_be_configured_and_strong_enough(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "must be configured"):
                get_internal_api_key()
        with patch.dict(os.environ, {"STUDYFLASH_INTERNAL_API_KEY": "too-short"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "at least 32"):
                get_internal_api_key()
        key = "a" * 32
        with patch.dict(os.environ, {"STUDYFLASH_INTERNAL_API_KEY": key}, clear=True):
            self.assertEqual(get_internal_api_key(), key)

    def test_internal_api_key_rejects_missing_or_wrong_values(self):
        expected = "a" * 32
        for provided in (None, "", "b" * 32):
            with self.subTest(provided=provided):
                with self.assertRaises(HTTPException) as raised:
                    verify_internal_api_key(provided, expected)
                self.assertEqual(raised.exception.status_code, 401)
                self.assertEqual(raised.exception.detail, "Não autorizado.")
        verify_internal_api_key(expected, expected)

    def test_pdf_metadata_rejects_wrong_extension_and_mime(self):
        with self.assertRaises(ValueError):
            validate_pdf_metadata("notes.txt", "application/pdf")
        with self.assertRaises(ValueError):
            validate_pdf_metadata("notes.pdf", "text/plain")
        validate_pdf_metadata("NOTES.PDF", "application/pdf")

    def test_pdf_signature_requires_real_pdf_header(self):
        validate_pdf_signature(b"%PDF-1.7\nbody")
        with self.assertRaises(ValueError):
            validate_pdf_signature(b"not-a-pdf")

    async def test_bounded_reader_accepts_small_pdf(self):
        data = b"%PDF-1.7\n" + b"x" * 32
        result = await read_upload_limited(FakeUpload(data), max_bytes=128, chunk_size=8)
        self.assertEqual(result, data)

    async def test_bounded_reader_rejects_oversized_upload(self):
        data = b"%PDF-1.7\n" + b"x" * 128
        upload = FakeUpload(data)
        with self.assertRaisesRegex(ValueError, "tamanho máximo"):
            await read_upload_limited(upload, max_bytes=64, chunk_size=16)
        self.assertLess(upload.offset, len(data))


if __name__ == "__main__":
    unittest.main()
