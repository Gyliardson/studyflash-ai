from __future__ import annotations


class AIError(RuntimeError):
    """Base class for safe StudyFlash AI-domain failures."""


class AIInvalidInputError(AIError):
    """The caller supplied input that cannot be processed."""


class AIProviderError(AIError):
    """Base class for remote-provider failures."""


class AIProviderRateLimitError(AIProviderError):
    """The configured provider capacity/rate limit is exhausted."""


class AIProviderTimeoutError(AIProviderError):
    """The provider exceeded the configured request timeout."""


class AIProviderUnavailableError(AIProviderError):
    """The provider failed for a transient/unavailable reason."""


class AIInvalidOutputError(AIError):
    """The provider returned output that does not satisfy StudyFlash contracts."""
