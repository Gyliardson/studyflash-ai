import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.main import app, gerar_flashcards


class FakeUpload:
    def __init__(self, data: bytes, *, filename: str = "notes.pdf", content_type: str = "application/pdf"):
        self.data = data
        self.filename = filename
        self.content_type = content_type
        self.offset = 0

    async def read(self, size: int = -1) -> bytes:
        if self.offset >= len(self.data):
            return b""
        if size < 0:
            size = len(self.data) - self.offset
        chunk = self.data[self.offset:self.offset + size]
        self.offset += len(chunk)
        return chunk


class PDFEndpointSemanticsTests(unittest.IsolatedAsyncioTestCase):
    def test_real_pdf_generation_route_is_registered(self):
        routes = [route for route in app.routes if getattr(route, "path", None) == "/api/gerar"]
        self.assertEqual(len(routes), 1)
        self.assertIn("POST", routes[0].methods)
        self.assertIs(routes[0].endpoint, gerar_flashcards)

    async def test_invalid_pdf_metadata_maps_to_400(self):
        upload = FakeUpload(b"%PDF-1.7\nbody", filename="notes.txt")
        with self.assertRaises(HTTPException) as raised:
            await gerar_flashcards(arquivo=upload, texto=None)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Arquivo PDF inválido.")

    async def test_invalid_pdf_signature_maps_to_400(self):
        upload = FakeUpload(b"not-a-pdf")
        with self.assertRaises(HTTPException) as raised:
            await gerar_flashcards(arquivo=upload, texto=None)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Arquivo PDF inválido.")

    async def test_oversized_pdf_maps_to_413_and_stops_reading_early(self):
        data = b"%PDF-1.7\n" + b"x" * 256
        upload = FakeUpload(data)
        with patch.dict(os.environ, {"MAX_PDF_BYTES": "32"}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                await gerar_flashcards(arquivo=upload, texto=None)
        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.detail, "PDF excede o tamanho máximo permitido.")
        self.assertLess(upload.offset, len(data))

    async def test_unexpected_parser_failure_stays_sanitized_500(self):
        upload = FakeUpload(b"%PDF-1.7\nbody")
        with patch("app.main.extrair_texto_do_pdf", side_effect=RuntimeError("sensitive-parser-detail")):
            with self.assertRaises(HTTPException) as raised:
                await gerar_flashcards(arquivo=upload, texto=None)
        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(raised.exception.detail, "Erro interno ao processar solicitação.")
        self.assertNotIn("sensitive", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
