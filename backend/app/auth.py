"""Auth0 JWT verification — wire in last, around hour 18-20, per README §6.
Every endpoint should work against a hardcoded owner_id until then; this
dependency is not yet attached to any route."""

import os

from fastapi import Header, HTTPException


async def verify_token(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    domain = os.environ.get("AUTH0_DOMAIN")
    if not domain:
        raise HTTPException(status_code=500, detail="AUTH0_DOMAIN not configured")

    # TODO: verify `token` against Auth0's JWKS for `domain` before relying
    # on this in production. Left unimplemented until Auth0 is actually
    # wired in, per README §6.
    return token
