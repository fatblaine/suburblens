"""Supabase JWT verification for the agent.

The frontend sends the user's Supabase access token as `Authorization: Bearer <jwt>`.
This project signs tokens with asymmetric JWT signing keys (ECC P-256 / ES256), so we
verify the signature against Supabase's public JWKS endpoint — the agent holds no secret.
Anonymous (guest) users are rejected: only registered accounts may use the AI assistant.
"""
import os
import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")

# Supabase signs user tokens with this audience; current keys are ES256 (ECC P-256).
# RS256 is allowed too in case the project later rotates to an RSA signing key.
_AUDIENCE = "authenticated"
_ALGORITHMS = ["ES256", "RS256"]

# PyJWKClient fetches and caches the public keys; built lazily on first use.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise HTTPException(status_code=500, detail="SUPABASE_URL is not configured on the server.")
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def _decode(token: str) -> dict:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except Exception:
        # Bad signature, wrong audience, unknown key id, JWKS fetch failure, etc.
        raise HTTPException(status_code=401, detail="Invalid token.")


# Sync def → FastAPI runs it in a threadpool, so the (cached) JWKS fetch never
# blocks the event loop.
def require_registered_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: allow only authenticated, non-anonymous users.

    Returns the decoded claims (including `sub` = user id) for downstream use,
    e.g. per-user rate limiting.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    claims = _decode(authorization.split(" ", 1)[1].strip())

    if claims.get("is_anonymous", False):
        raise HTTPException(
            status_code=403,
            detail="The AI assistant requires a registered account.",
        )
    return claims
