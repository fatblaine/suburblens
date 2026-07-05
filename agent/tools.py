import os
import httpx
from langchain_core.tools import tool

BASE = os.environ.get("SUBURBLENS_API_BASE", "http://localhost:5000")

# One shared client = connection pooling + a sane default timeout
_client = httpx.Client(base_url=BASE, timeout=10.0)


def _get(path: str, **params) -> dict | list:
    """GET a SuburbLens endpoint, returning data or a structured error.
    Never raises — the agent reads the error and decides what to do next."""
    try:
        r = _client.get(path, params=params or None)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "not_found",
                    "message": f"No data found for {path}. "
                               "Check the salCode is correct (call search_suburb first)."}
        return {"error": "http_error",
                "message": f"API returned {e.response.status_code} for {path}."}
    except httpx.TimeoutException:
        return {"error": "timeout",
                "message": f"Request to {path} timed out. The data service may be slow."}
    except httpx.RequestError as e:
        return {"error": "connection_error",
                "message": f"Could not reach the data service: {e!s}"}


@tool
def search_suburb(name: str) -> list[dict] | dict:
    """Search for Australian suburbs by name. Returns salCode, salName, stateName.
    Always call this first to get the salCode before fetching any suburb data."""
    return _get("/api/suburbs/search", q=name)


@tool
def get_tenure(sal_code: str) -> dict:
    """Get tenure trends (owned/mortgage/rented) for a suburb across 2011/2016/2021.
    Also returns Residency Shift Index (SuburbLens Custom metric)."""
    return _get(f"/api/suburbs/{sal_code}/tenure")


@tool
def get_education(sal_code: str) -> dict:
    """Get education qualification distribution for a suburb across 2011/2016/2021.
    Includes university-qualified rate and other qualification levels."""
    return _get(f"/api/suburbs/{sal_code}/education")


@tool
def get_language(sal_code: str) -> dict:
    """Get languages spoken at home distribution for a suburb across census years."""
    return _get(f"/api/suburbs/{sal_code}/language")


@tool
def get_birthcountry(sal_code: str) -> dict:
    """Get country of birth distribution for a suburb across census years."""
    return _get(f"/api/suburbs/{sal_code}/birthcountry")


@tool
def get_nearby(sal_code: str, limit: int = 5) -> dict:
    """Get suburbs within 20km of the given suburb."""
    return _get(f"/api/suburbs/{sal_code}/nearby", limit=limit)


@tool
def get_crime(sal_code: str) -> dict:
    """Get recorded criminal incidents for a suburb, GREATER MELBOURNE ONLY.
    Returns yearly counts (year ending March, ~2022-2026) per offence category
    (assault, break_enter, theft, robbery, property_damage, other) plus a total.
    These are counts, NOT population-adjusted rates — compare a suburb against
    its own trend over time, not against other suburbs. Returns a 404 not_found
    error for Sydney/NSW suburbs (crime data is Melbourne-only for now)."""
    return _get(f"/api/suburbs/{sal_code}/crime")


tools = [search_suburb, get_tenure, get_education,
         get_language, get_birthcountry, get_nearby, get_crime]
