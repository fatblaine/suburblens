import os
import httpx
from langchain_core.tools import tool
from dotenv import load_dotenv

# tools is imported (via graph) BEFORE server/graph call load_dotenv(), so load
# .env here too — otherwise BASE resolves to the default before .env is read and
# the agent silently hits the wrong port ("connection issue"). load_dotenv is
# idempotent, so calling it again in the other modules is harmless.
load_dotenv()

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
def get_distances(sal_code: str) -> dict:
    """Get STRAIGHT-LINE (great-circle) distances from a suburb to key points of
    interest — the city CBD and major universities. Available for both Sydney and
    Melbourne suburbs. Returns `distances`: a list of {name, shortName, category
    ("cbd" or "university"), distanceMeters}. distanceMeters is a straight-line
    "as the crow flies" distance in metres, NOT travel time or road distance — say
    it in km and make clear it is not a commute duration. A 404 not_found error
    means the suburb is out of scope."""
    return _get(f"/api/suburbs/{sal_code}/distances")


@tool
def get_housing_mix(sal_code: str) -> dict:
    """Get the 2021 Census dwelling-structure (housing mix) snapshot for a suburb,
    i.e. the unit-to-house makeup. Under `housing`: separateHouses,
    semiDetachedTownhouses, apartments, otherDwellings,
    totalOccupiedPrivateDwellings, apartmentSharePct, townhouseSharePct, and
    attachedDwellingsPer100Houses — the headline "unit-to-house" ratio (attached
    dwellings, i.e. townhouses + apartments, per 100 separate houses). Compare it
    to cityMedianAttachedDwellingsPer100Houses (the Greater Sydney / Greater
    Melbourne benchmark): well above the median = apartment/townhouse-heavy, well
    below = dominated by separate houses. A 404 not_found error means the suburb is
    out of scope."""
    return _get(f"/api/suburbs/{sal_code}/housing-mix")


@tool
def get_crime(sal_code: str) -> dict:
    """Get recorded criminal incidents for a suburb, GREATER MELBOURNE ONLY.
    Returns yearly counts (year ending March, ~2022-2026) per offence category
    (assault, break_enter, theft, robbery, property_damage, other) plus a total.
    Also returns a `benchmark` object comparing this suburb's latest-year total
    against ALL Greater Melbourne suburbs: percentileRank (0-1 = share of suburbs
    it exceeds), medianTotal, cohortMax, cohortCount. These are incident COUNTS,
    NOT population-adjusted — the benchmark ranks by raw volume, so larger and
    inner-city suburbs sit higher by nature; use it as a rough position, not a
    per-person safety measure. Returns a 404 not_found error for Sydney/NSW
    suburbs (crime data is Melbourne-only for now)."""
    return _get(f"/api/suburbs/{sal_code}/crime")


@tool
def get_density(sal_code: str) -> dict:
    """Get population density for a suburb, computed directly on the SAL boundary
    (not a primary-SA2 proxy). Returns persons per km² plus a within-city
    percentile benchmark (percentileRank 0-1 = share of Sydney/Melbourne suburbs
    this one is denser than) so you can say whether it is crowded or spacious
    relative to the rest of the city. A 404 not_found error means the suburb is
    out of scope."""
    return _get(f"/api/suburbs/{sal_code}/density")


@tool
def get_amenities(sal_code: str) -> dict:
    """Get local amenity counts for a suburb: how many places to eat and drink
    (food), bars/pubs/nightclubs (nightlife) and supermarkets/convenience stores
    (grocery) sit inside the suburb boundary. Use this for "is there anything to
    do there", "is it walkable / lively / dead", "can I get groceries nearby"
    style questions — this is the liveliness and convenience dimension the census
    has no data for. Counts come from OpenStreetMap (community-mapped, indicative
    rather than exhaustive), so quote them as approximate. benchmark.percentileRank
    (0-1) ranks the suburb by amenities per km2 within the same capital city, so a
    small inner suburb and a large outer one compare fairly; prefer it over the
    raw totals when comparing suburbs. A total of 0 usually means parkland, water
    or industrial land rather than a mapping gap. A 404 not_found error means the
    suburb is out of scope."""
    return _get(f"/api/suburbs/{sal_code}/amenities")


@tool
def rank_suburbs(
    city: str | None = None,               # "sydney" | "melbourne"
    language: str | None = None,           # mandarin|cantonese|chinese|vietnamese|hindi|punjabi|arabic|korean|tamil|nepali|italian|greek|spanish
    min_language_pct: float | None = None,  # applies to the chosen language
    born_country: str | None = None,       # china|india|vietnam|philippines|uk|southKorea|nepal
    min_born_pct: float | None = None,
    min_university_pct: float | None = None,
    trend: str | None = None,              # "ownership" | "rental" | "stable"
    max_rented_share_pct: float | None = None,
    sort_by: str | None = None,            # "universityPct"|"languagePct"|"residencyShiftIndex"|"population"
    limit: int = 8,
) -> dict:
    """Find and RANK Sydney/Melbourne suburbs matching demographic criteria, for
    when the user describes what they WANT but does NOT name a specific suburb
    (e.g. "find a suburb with a big Vietnamese community and lots of uni grads,
    family-owned not investor"). Pick language / born_country from the lists above
    to match ANY community, not just one. All percentages are 2021 census;
    rentedShare is the share of renters, NOT a rent price. Returns {count,
    results:[...]} with each suburb's numbers so you can quote them. If count is 0,
    drop the least important filter and call again."""
    params = {k: v for k, v in {
        "city": city,
        "language": language,
        "minLanguagePct": min_language_pct,
        "bornCountry": born_country,
        "minBornPct": min_born_pct,
        "minUniversityPct": min_university_pct,
        "trend": trend,
        "maxRentedSharePct": max_rented_share_pct,
        "sortBy": sort_by,
        "limit": limit,
    }.items() if v is not None}
    return _get("/api/suburbs/rank", **params)


tools = [search_suburb, get_tenure, get_education,
         get_language, get_birthcountry, get_nearby, get_distances,
         get_housing_mix, get_crime, get_density, get_amenities, rank_suburbs]
