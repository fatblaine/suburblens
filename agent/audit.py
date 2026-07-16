"""Security-event audit writes.

Design rule #1: NEVER affect the main request. Any failure here is swallowed and
printed, never raised — audit logging is an accessory, a DB blip must not 500 a
user. Design rule #2: privacy minimisation — store a non-reversible hash of the
user id and a truncated, normalised payload snippet, never the raw identity or
full message. Only called on the abnormal paths (blocked / fail_open / canary);
normal questions are never written.
"""
import hashlib


def hash_user(sub: str) -> str:
    """Fold the Supabase user id into a short, non-reversible hash. Lets us
    correlate 'the same user probing repeatedly' without storing who they are."""
    return hashlib.sha256(sub.encode()).hexdigest()[:16]


async def log_security_event(pool, *, user_id: str, thread_id: str, layer: str, snippet: str) -> None:
    """Insert one security event. Silently skips when pool is None (local dev
    without Supabase). Never raises."""
    if pool is None:
        return
    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    insert into ai_security_events (user_hash, thread_id, layer, snippet)
                    values (%s, %s, %s, %s)
                    """,
                    (hash_user(user_id), thread_id[:64], layer, snippet[:500]),
                )
    except Exception as e:
        # An audit-write failure must never drag down the user's request.
        print(f"[audit] failed to log security event ({layer}): {e!r}")
