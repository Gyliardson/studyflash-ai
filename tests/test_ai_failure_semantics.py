from __future__ import annotations

import json
import os
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app.ai_errors import (
    AIInvalidInputError,
    AIInvalidOutputError,
    AIProviderRateLimitError,
    AIProviderTimeoutError,
    AIProviderUnavailableError,
)
from app.ai_provider import (
    DEFAULT_PROVIDER_TIMEOUT_SECONDS,
    GroqAIProvider,
    _provider_timeout_seconds,
    get_ai_provider,
    invoke_with_bounded_fallback,
)
from app.main import _ai_http_exception, app


TEST_INTERNAL_KEY = "studyflash-internal-test-key-0000000000000000"
PROVIDER_SECRET_MARKER = "provider-secret-must-not-leak"


class StatusError(RuntimeError):
    def __init__(self, status_code: int, message: str = "provider failure") -> None:
        super().__init__(message)
        self.status_code = status_code


class OutputParserException(RuntimeError):
    pass


class AIFailureSemanticsTests(unittest.TestCase):
    def tearDown(self) -> None:
        get_ai_provider.cache_clear()

    def _post_flashcards(self, *, text: str = "Mitose divide uma célula em duas células-filhas."):
        client = TestClient(app, raise_server_exceptions=False)
        return client.post(
            "/api/gerar",
            headers={"X-StudyFlash-Internal-Key": TEST_INTERNAL_KEY},
            data={"texto": text},
        )

    def test_primary_rate_limit_uses_exactly_one_backup(self) -> None:
        primary = Mock(side_effect=StatusError(429, "secret provider text"))
        backup = Mock(return_value="ok")

        self.assertEqual(invoke_with_bounded_fallback(primary, backup), "ok")
        primary.assert_called_once_with()
        backup.assert_called_once_with()

    def test_timeout_is_typed_and_does_not_fall_back(self) -> None:
        primary = Mock(side_effect=TimeoutError("socket secret"))
        backup = Mock(return_value="should not run")

        with self.assertRaises(AIProviderTimeoutError):
            invoke_with_bounded_fallback(primary, backup)

        backup.assert_not_called()

    def test_provider_5xx_is_typed_unavailable_and_does_not_fall_back(self) -> None:
        primary = Mock(side_effect=StatusError(503, "upstream body must not escape"))
        backup = Mock(return_value="should not run")

        with self.assertRaises(AIProviderUnavailableError):
            invoke_with_bounded_fallback(primary, backup)

        backup.assert_not_called()

    def test_structured_output_parser_failure_is_typed(self) -> None:
        primary = Mock(side_effect=OutputParserException("raw model output"))
        backup = Mock(return_value="should not run")

        with self.assertRaises(AIInvalidOutputError):
            invoke_with_bounded_fallback(primary, backup)

        backup.assert_not_called()

    def test_json_decode_failure_is_typed_invalid_output(self) -> None:
        primary = Mock(side_effect=json.JSONDecodeError("bad", "not-json", 0))
        backup = Mock(return_value="should not run")

        with self.assertRaises(AIInvalidOutputError):
            invoke_with_bounded_fallback(primary, backup)

        backup.assert_not_called()

    def test_backup_rate_limit_is_typed_after_single_fallback(self) -> None:
        primary = Mock(side_effect=StatusError(429))
        backup = Mock(side_effect=StatusError(429))

        with self.assertRaises(AIProviderRateLimitError):
            invoke_with_bounded_fallback(primary, backup)

        primary.assert_called_once_with()
        backup.assert_called_once_with()

    def test_timeout_configuration_defaults_and_rejects_unbounded_values(self) -> None:
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("AI_PROVIDER_TIMEOUT_SECONDS", None)
            self.assertEqual(_provider_timeout_seconds(), DEFAULT_PROVIDER_TIMEOUT_SECONDS)

        for value in ("0", "-1", "not-a-number", "10", "999"):
            with self.subTest(value=value), patch.dict(os.environ, {"AI_PROVIDER_TIMEOUT_SECONDS": value}):
                self.assertEqual(_provider_timeout_seconds(), DEFAULT_PROVIDER_TIMEOUT_SECONDS)

    @patch("app.ai_provider.ChatGroq")
    def test_groq_clients_have_explicit_timeout_and_zero_sdk_retries(self, chat_groq: Mock) -> None:
        with patch.dict(
            os.environ,
            {"AI_PROVIDER_TIMEOUT_SECONDS": "7.5", "GROQ_API_KEY": "test-provider-key"},
        ):
            GroqAIProvider()

        self.assertEqual(chat_groq.call_count, 2)
        for call in chat_groq.call_args_list:
            self.assertEqual(call.kwargs["timeout"], 7.5)
            self.assertEqual(call.kwargs["max_retries"], 0)

    @patch("app.ai_provider.ChatGroq")
    def test_missing_provider_config_is_typed_before_client_construction(self, chat_groq: Mock) -> None:
        with patch.dict(os.environ, {"STUDYFLASH_INTERNAL_API_KEY": TEST_INTERNAL_KEY}, clear=False):
            os.environ.pop("GROQ_API_KEY", None)
            get_ai_provider.cache_clear()

            with self.assertRaises(AIProviderUnavailableError):
                get_ai_provider()

        chat_groq.assert_not_called()

    @patch("app.ai_provider.ChatGroq")
    def test_missing_provider_config_endpoint_returns_sanitized_503(self, chat_groq: Mock) -> None:
        with patch.dict(os.environ, {"STUDYFLASH_INTERNAL_API_KEY": TEST_INTERNAL_KEY}, clear=False):
            os.environ.pop("GROQ_API_KEY", None)
            get_ai_provider.cache_clear()
            response = self._post_flashcards()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"detail": "O serviço de IA está temporariamente indisponível."},
        )
        self.assertNotIn("GROQ_API_KEY", response.text)
        chat_groq.assert_not_called()

    @patch("app.ai_provider.ChatGroq", side_effect=ValueError(f"invalid config: {PROVIDER_SECRET_MARKER}"))
    def test_invalid_provider_constructor_returns_sanitized_503(self, chat_groq: Mock) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "STUDYFLASH_INTERNAL_API_KEY": TEST_INTERNAL_KEY,
                    "GROQ_API_KEY": PROVIDER_SECRET_MARKER,
                },
                clear=False,
            ),
            patch("builtins.print") as print_mock,
        ):
            get_ai_provider.cache_clear()
            response = self._post_flashcards()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"detail": "O serviço de IA está temporariamente indisponível."},
        )
        self.assertNotIn(PROVIDER_SECRET_MARKER, response.text)
        self.assertNotIn("invalid config", response.text)
        logged = " ".join(str(arg) for call in print_mock.call_args_list for arg in call.args)
        self.assertNotIn(PROVIDER_SECRET_MARKER, logged)
        chat_groq.assert_called_once()

    @patch("app.ai_provider.ChatGroq", side_effect=RuntimeError(f"unexpected defect: {PROVIDER_SECRET_MARKER}"))
    def test_unexpected_provider_constructor_bug_remains_generic_500(self, chat_groq: Mock) -> None:
        with patch.dict(
            os.environ,
            {
                "STUDYFLASH_INTERNAL_API_KEY": TEST_INTERNAL_KEY,
                "GROQ_API_KEY": PROVIDER_SECRET_MARKER,
            },
            clear=False,
        ):
            get_ai_provider.cache_clear()
            response = self._post_flashcards()

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Erro interno ao processar solicitação."})
        self.assertNotIn(PROVIDER_SECRET_MARKER, response.text)
        chat_groq.assert_called_once()

    def test_fastapi_mapping_is_typed_and_never_echoes_exception_text(self) -> None:
        cases = [
            (AIInvalidInputError("private input detail"), 422),
            (AIProviderRateLimitError("private rate body"), 429),
            (AIProviderTimeoutError("private timeout body"), 504),
            (AIProviderUnavailableError("private upstream body"), 503),
            (AIInvalidOutputError("private raw model output"), 502),
        ]

        for exc, expected_status in cases:
            with self.subTest(exc=type(exc).__name__):
                http = _ai_http_exception(exc)
                self.assertEqual(http.status_code, expected_status)
                self.assertNotIn("private", str(http.detail).lower())
                self.assertNotIn(str(exc), str(http.detail))


if __name__ == "__main__":
    unittest.main()
