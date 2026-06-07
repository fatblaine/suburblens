import os
import httpx
from langchain_core.tools import tool

BASE = os.environ.get("SUBURBLENS_API_BASE", "http://localhost:5000")

@tool
def search_suburb(name: str) -> list[dict]:
    """Search for Australian suburbs by name. Returns salCode, salName, stateName.
    Always call this first to get the salCode before fetching any suburb data."""
    r = httpx.get(f"{BASE}/api/suburbs/search", params={"q": name})
    r.raise_for_status()
    return r.json()

@tool
def get_tenure(sal_code: str) -> dict:
    """Get tenure trends (owned/mortgage/rented) for a suburb across 2011/2016/2021.
    Also returns Residency Shift Index (SuburbLens Custom metric)."""
    r = httpx.get(f"{BASE}/api/suburbs/{sal_code}/tenure")
    r.raise_for_status()
    return r.json()

@tool
def get_education(sal_code: str) -> dict:
    """Get education qualification distribution for a suburb across 2011/2016/2021.
    Includes university-qualified rate and other qualification levels."""
    r = httpx.get(f"{BASE}/api/suburbs/{sal_code}/education")
    r.raise_for_status()
    return r.json()

@tool
def get_language(sal_code: str) -> dict:
    """Get languages spoken at home distribution for a suburb across census years."""
    r = httpx.get(f"{BASE}/api/suburbs/{sal_code}/language")
    r.raise_for_status()
    return r.json()

@tool
def get_birthcountry(sal_code: str) -> dict:
    """Get country of birth distribution for a suburb across census years."""
    r = httpx.get(f"{BASE}/api/suburbs/{sal_code}/birthcountry")
    r.raise_for_status()
    return r.json()

@tool
def get_nearby(sal_code: str, limit: int = 5) -> dict:
    """Get suburbs within 20km of the given suburb."""
    r = httpx.get(f"{BASE}/api/suburbs/{sal_code}/nearby", params={"limit": limit})
    r.raise_for_status()
    return r.json()

tools = [search_suburb, get_tenure, get_education,
         get_language, get_birthcountry, get_nearby]
