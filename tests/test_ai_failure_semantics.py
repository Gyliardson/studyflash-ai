from __future__ import annotations

import json
import os
import unittest
from unittest.mock import Mock, patch

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
    invoke_with_bounded_fallback,
)
from app.main import _ai_http_exception


class StatusError(RuntimeError):
    def __init__(self, status_code: int, message: str = "provider failure") -> None:
        super().__init__(message)
        self.status_code = status_code


class OutputParserException(RuntimeError):
    pass


class AIFailureSemanticsTests(unittest.TestCase):
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

        for value in ("0", "-1", "not-a-number", "999"):
            with self.subTest(value=value), patch.dict(os.environ, {"AI_PROVIDER_TIMEOUT_SECONDS": value}):
                self.assertEqual(_provider_timeout_seconds(), DEFAULT_PROVIDER_TIMEOUT_SECONDS)

    @patch("app.ai_provider.ChatGroq")
    def test_groq_clients_have_explicit_timeout_and_zero_sdk_retries(self, chat_groq: Mock) -> None:
        with patch.dict(os.environ, {"AI_PROVIDER_TIMEOUT_SECONDS": "7.5"}):
            GroqAIProvider()

        self.assertEqual(chat_groq.call_count, 2)
        for call in chat_groq.call_args_list:
            self.assertEqual(call.kwargs["timeout"], 7.5)
            self.assertEqual(call.kwargs["max_retries"], 0)

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
