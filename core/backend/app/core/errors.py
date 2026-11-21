"""Domain-level exception hierarchy for the VVWA FastAPI engine."""


class VvwaError(Exception):
    """Base class for controlled VVWA application errors."""


class InvalidLabIdError(VvwaError):
    """Raised when a lab identifier or action name violates safe naming rules."""


class LabNotFoundError(VvwaError):
    """Raised when a requested lab directory or required lab file does not exist."""


class ActionNotFoundError(VvwaError):
    """Raised when a requested async handler function is absent in a lab module."""


class InvalidActorError(VvwaError):
    """Raised when the X-VVWA-Actor session header is malformed or names an unknown user."""


class InvalidExpectationError(VvwaError):
    """Raised when a verifyTests expect block uses an unknown or malformed operator."""


class DatabaseUnavailableError(VvwaError):
    """Raised when PostgreSQL cannot be reached or reset execution fails."""
