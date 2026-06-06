---
name: Distance Calculator
overview: POST /distance endpoint — geodesic distance in km between two addresses
todos:
  - id: write-tests
    content: Write failing tests from Test contracts
    status: pending
  - id: implement-distance-logic
    content: Add distance_between() to geocoding.py using geopy geodesic
    status: pending
  - id: implement-endpoint
    content: Add POST /distance route to main.py
    status: pending
  - id: verify-green
    content: Run pytest; confirm all tests pass
    status: pending
---

## Goal

Add a `POST /distance` endpoint that accepts two addresses (origin and destination), geocodes each using the existing Nominatim integration, and returns the straight-line geodesic distance between them in kilometres. This builds directly on the already-present `geocode_address` function and `geopy` dependency — no new external services are required.

## Architecture

```
POST /distance
  │
  ├─ validate: origin and destination must be non-empty strings
  │
  ├─ geocode_address(origin)   ──► (lat1, lon1)   [reuse existing]
  ├─ geocode_address(destination) ► (lat2, lon2)
  │
  ├─ distance_between(lat1, lon1, lat2, lon2)
  │     └─ geopy.distance.geodesic(...).km
  │
  └─ {"distance_km": <float>}
```

**New function** — `distance_between(lat1, lon1, lat2, lon2) -> float` in `src/app/geocoding.py`. Keeps distance logic co-located with geocoding logic and easy to unit-test independently.

**New route** — `POST /distance` in `src/app/main.py`. Follows the same guard-then-call pattern as `/geocode`.

**No new dependencies** — `geopy.distance.geodesic` is already available.

## User-visible behaviour

### Happy path

`POST /distance` with a JSON body `{"origin": "<addr1>", "destination": "<addr2>"}`.

- Returns `200 OK` with body `{"distance_km": <float>}`.
- `distance_km` is a non-negative float (kilometres, full float precision from geopy geodesic).
- Same-point addresses (identical coords) return `{"distance_km": 0.0}` — not an error.

### Validation errors (400)

| Condition | Response |
|---|---|
| `origin` is empty or whitespace-only | `400 {"detail": "Origin address must not be empty"}` |
| `destination` is empty or whitespace-only | `400 {"detail": "Destination address must not be empty"}` |
| Either field missing from body | `422 Unprocessable Entity` (FastAPI default) |

Validation is checked before any geocoding call.

### Geocoding failures

Same error bubbling as `/geocode`, but identify which address failed:

| Condition | Response |
|---|---|
| Origin not found | `404 {"detail": "Origin address not found"}` |
| Destination not found | `404 {"detail": "Destination address not found"}` |
| Geocoding service error (either address) | `503 {"detail": "Geocoding service unavailable"}` |

Origin is geocoded first; if it fails, destination is never attempted.

### Wrong HTTP method

`GET /distance` → `405 {"detail": "Method Not Allowed"}`.

## Test contracts

### TDD approach

Tests are written **before** implementation (Red → Green):

1. **Red** — write the full test suite from the contracts below; every test must fail with `404 Not Found` (route doesn't exist yet) or `AttributeError`.
2. **Green** — implement `distance_between()` and the `/distance` route until all tests pass.
3. Tests are the contract — the implementation must not modify them.

---

Mock target for all route tests: `app.geocoding.geocode_address` (same as existing tests).  
Mock target for `distance_between` unit tests: `geopy.distance.geodesic`.

### Unit tests — `distance_between()`

| Test | Input | Expected |
|---|---|---|
| Returns correct km | `(37.422, -122.084, 51.5074, -0.1278)` | `float`, approximately `8637.0` (±5 km) |
| Same point returns 0 | `(37.422, -122.084, 37.422, -122.084)` | `0.0` |

### Route tests — happy path

```
geocode_address side_effect = [(37.422, -122.084), (51.5074, -0.1278)]
POST /distance {"origin": "Mountain View, CA", "destination": "London, UK"}
```

| Test | Assertion |
|---|---|
| Status 200 | `response.status_code == 200` |
| Body has distance_km key | `"distance_km" in response.json()` |
| distance_km is a float | `isinstance(response.json()["distance_km"], float)` |
| geocode_address called twice | `mock_fn.call_count == 2` |
| first call with origin | `mock_fn.call_args_list[0].args[0] == "Mountain View, CA"` |
| second call with destination | `mock_fn.call_args_list[1].args[0] == "London, UK"` |

### Route tests — same-point (distance = 0)

```
geocode_address side_effect = [(37.422, -122.084), (37.422, -122.084)]
POST /distance {"origin": "Same Place", "destination": "Same Place"}
```

| Test | Assertion |
|---|---|
| Status 200 | `response.status_code == 200` |
| distance_km is 0.0 | `response.json()["distance_km"] == 0.0` |

### Route tests — validation (400)

```
POST /distance {"origin": "", "destination": "London"}
```
- Status `400`
- Body `{"detail": "Origin address must not be empty"}`
- `geocode_address` not called

```
POST /distance {"origin": "   ", "destination": "London"}
```
- Status `400`, same detail

```
POST /distance {"origin": "Mountain View", "destination": ""}
```
- Status `400`
- Body `{"detail": "Destination address must not be empty"}`
- `geocode_address` not called

```
POST /distance {"origin": "Mountain View", "destination": "   "}
```
- Status `400`, same detail

### Route tests — missing fields (422)

```
POST /distance {}
POST /distance {"origin": "Mountain View"}
POST /distance {"destination": "London"}
```
- All return status `422`

### Route tests — address not found (404)

```
geocode_address side_effect = [AddressNotFoundError]
POST /distance {"origin": "xyznonexistent", "destination": "London"}
```
- Status `404`
- Body `{"detail": "Origin address not found"}`

```
geocode_address side_effect = [(37.422, -122.084), AddressNotFoundError]
POST /distance {"origin": "Mountain View", "destination": "xyznonexistent"}
```
- Status `404`
- Body `{"detail": "Destination address not found"}`

### Route tests — service error (503)

```
geocode_address side_effect = [GeocodingServiceError]
POST /distance {"origin": "Mountain View", "destination": "London"}
```
- Status `503`
- Body `{"detail": "Geocoding service unavailable"}`

```
geocode_address side_effect = [(37.422, -122.084), GeocodingServiceError]
POST /distance {"origin": "Mountain View", "destination": "London"}
```
- Status `503`
- Body `{"detail": "Geocoding service unavailable"}`

### Route tests — wrong method

```
GET /distance
```
- Status `405`
- Body `{"detail": "Method Not Allowed"}`

## Files to add / modify

| File | Change |
|---|---|
| `src/app/geocoding.py` | Add `distance_between(lat1, lon1, lat2, lon2) -> float` |
| `src/app/main.py` | Add `DistanceRequest`, `DistanceResponse` models; add `POST /distance` route |
| `tests/test_distance.py` | New test file (all contracts above) |

## Out of scope

- Driving/routing distance (roads, traffic)
- Miles or dual-unit responses
- Caching geocoding results
- Batch distance requests (multiple pairs)
- Async geocoding
- Rate limiting
