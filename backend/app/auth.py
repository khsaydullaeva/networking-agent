"""Auth0 ID token verification. Wired in for real now — the mobile app
logs in via Auth0's Universal Login with LinkedIn as the social
connection (see mobile/README.md §7), then sends the resulting ID token
as `Authorization: Bearer <id_token>` on POST /auth/session.

We verify the ID token (not the access token): Auth0 always issues it as
an RS256 JWT with `aud` = the Auth0 application's client_id, so it can be
verified here with zero extra Auth0 API/resource-server setup.
"""

import os
from functools import lru_cache

import httpx
from fastapi import Header, HTTPException
from jose import JWTError, jwt


@lru_cache
def _jwks() -> dict:
    domain = os.environ["AUTH0_DOMAIN"]
    resp = httpx.get(f"https://{domain}/.well-known/jwks.json", timeout=10)
    resp.raise_for_status()
    return resp.json()


async def verify_token(authorization: str = Header(default=None)) -> dict:
    """FastAPI dependency: verifies the bearer token and returns its
    decoded claims (including `sub`, the stable Auth0 user id). Raises 401
    on any missing/malformed/invalid/expired token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    domain = os.environ.get("AUTH0_DOMAIN")
    client_id = os.environ.get("AUTH0_CLIENT_ID")
    if not domain or not client_id:
        raise HTTPException(status_code=500, detail="AUTH0_DOMAIN/AUTH0_CLIENT_ID not configured")

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}") from e

    rsa_key = next(
        (
            {"kty": k["kty"], "kid": k["kid"], "use": k["use"], "n": k["n"], "e": k["e"]}
            for k in _jwks()["keys"]
            if k["kid"] == unverified_header.get("kid")
        ),
        None,
    )
    if rsa_key is None:
        raise HTTPException(status_code=401, detail="Unable to find matching signing key")

    try:
        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=f"https://{domain}/",
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}") from e

    return claims
