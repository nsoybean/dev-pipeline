from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.geocoding import (
    AddressNotFoundError,
    GeocodingServiceError,
    distance_between,
)

client = TestClient(app)

GEOCODE_MOCK = "app.geocoding.geocode_address"
GEODESIC_MOCK = "geopy.distance.geodesic"

HAPPY_ORIGIN = "Mountain View, CA"
HAPPY_DESTINATION = "London, UK"
HAPPY_COORDS_ORIGIN = (37.422, -122.084)
HAPPY_COORDS_DESTINATION = (51.5074, -0.1278)


# ---------------------------------------------------------------------------
# Unit tests — distance_between()
# ---------------------------------------------------------------------------


def test_distance_between_returns_correct_km():
    mock_geodesic = MagicMock()
    mock_geodesic.return_value.km = 8637.0
    with patch(GEODESIC_MOCK, mock_geodesic):
        result = distance_between(37.422, -122.084, 51.5074, -0.1278)
    assert isinstance(result, float)
    assert result == pytest.approx(8637.0, abs=5)


def test_distance_between_same_point_returns_zero():
    mock_geodesic = MagicMock()
    mock_geodesic.return_value.km = 0.0
    with patch(GEODESIC_MOCK, mock_geodesic):
        result = distance_between(37.422, -122.084, 37.422, -122.084)
    assert result == 0.0


# ---------------------------------------------------------------------------
# Route tests — happy path
# ---------------------------------------------------------------------------


def test_distance_happy_path_returns_200():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ):
        response = client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert response.status_code == 200


def test_distance_happy_path_body_has_distance_km_key():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ):
        response = client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert "distance_km" in response.json()


def test_distance_happy_path_distance_km_is_float():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ):
        response = client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert isinstance(response.json()["distance_km"], float)


def test_distance_happy_path_geocode_called_twice():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ) as mock_fn:
        client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert mock_fn.call_count == 2


def test_distance_happy_path_first_call_with_origin():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ) as mock_fn:
        client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert mock_fn.call_args_list[0].args[0] == HAPPY_ORIGIN


def test_distance_happy_path_second_call_with_destination():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, HAPPY_COORDS_DESTINATION],
    ) as mock_fn:
        client.post(
            "/distance",
            json={"origin": HAPPY_ORIGIN, "destination": HAPPY_DESTINATION},
        )
    assert mock_fn.call_args_list[1].args[0] == HAPPY_DESTINATION


# ---------------------------------------------------------------------------
# Route tests — same-point (distance = 0)
# ---------------------------------------------------------------------------


def test_distance_same_point_returns_200():
    coords = HAPPY_COORDS_ORIGIN
    with patch(GEOCODE_MOCK, side_effect=[coords, coords]):
        response = client.post(
            "/distance",
            json={"origin": "Same Place", "destination": "Same Place"},
        )
    assert response.status_code == 200


def test_distance_same_point_distance_km_is_zero():
    coords = HAPPY_COORDS_ORIGIN
    with patch(GEOCODE_MOCK, side_effect=[coords, coords]):
        response = client.post(
            "/distance",
            json={"origin": "Same Place", "destination": "Same Place"},
        )
    assert response.json()["distance_km"] == 0.0


# ---------------------------------------------------------------------------
# Route tests — validation (400)
# ---------------------------------------------------------------------------


def test_distance_empty_origin_returns_400():
    with patch(GEOCODE_MOCK) as mock_fn:
        response = client.post(
            "/distance",
            json={"origin": "", "destination": "London"},
        )
    assert response.status_code == 400


def test_distance_empty_origin_body():
    with patch(GEOCODE_MOCK):
        response = client.post(
            "/distance",
            json={"origin": "", "destination": "London"},
        )
    assert response.json() == {"detail": "Origin address must not be empty"}


def test_distance_empty_origin_geocoder_not_called():
    with patch(GEOCODE_MOCK) as mock_fn:
        client.post(
            "/distance",
            json={"origin": "", "destination": "London"},
        )
    mock_fn.assert_not_called()


def test_distance_whitespace_origin_returns_400():
    with patch(GEOCODE_MOCK) as mock_fn:
        response = client.post(
            "/distance",
            json={"origin": "   ", "destination": "London"},
        )
    assert response.status_code == 400


def test_distance_whitespace_origin_body():
    with patch(GEOCODE_MOCK):
        response = client.post(
            "/distance",
            json={"origin": "   ", "destination": "London"},
        )
    assert response.json() == {"detail": "Origin address must not be empty"}


def test_distance_empty_destination_returns_400():
    with patch(GEOCODE_MOCK) as mock_fn:
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": ""},
        )
    assert response.status_code == 400


def test_distance_empty_destination_body():
    with patch(GEOCODE_MOCK):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": ""},
        )
    assert response.json() == {"detail": "Destination address must not be empty"}


def test_distance_empty_destination_geocoder_not_called():
    with patch(GEOCODE_MOCK) as mock_fn:
        client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": ""},
        )
    mock_fn.assert_not_called()


def test_distance_whitespace_destination_returns_400():
    with patch(GEOCODE_MOCK) as mock_fn:
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "   "},
        )
    assert response.status_code == 400


def test_distance_whitespace_destination_body():
    with patch(GEOCODE_MOCK):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "   "},
        )
    assert response.json() == {"detail": "Destination address must not be empty"}


# ---------------------------------------------------------------------------
# Route tests — missing fields (422)
# ---------------------------------------------------------------------------


def test_distance_missing_both_fields_returns_422():
    response = client.post("/distance", json={})
    assert response.status_code == 422


def test_distance_missing_destination_returns_422():
    response = client.post("/distance", json={"origin": "Mountain View"})
    assert response.status_code == 422


def test_distance_missing_origin_returns_422():
    response = client.post("/distance", json={"destination": "London"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Route tests — address not found (404)
# ---------------------------------------------------------------------------


def test_distance_origin_not_found_returns_404():
    with patch(GEOCODE_MOCK, side_effect=[AddressNotFoundError]):
        response = client.post(
            "/distance",
            json={"origin": "xyznonexistent", "destination": "London"},
        )
    assert response.status_code == 404


def test_distance_origin_not_found_body():
    with patch(GEOCODE_MOCK, side_effect=[AddressNotFoundError]):
        response = client.post(
            "/distance",
            json={"origin": "xyznonexistent", "destination": "London"},
        )
    assert response.json() == {"detail": "Origin address not found"}


def test_distance_destination_not_found_returns_404():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, AddressNotFoundError],
    ):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "xyznonexistent"},
        )
    assert response.status_code == 404


def test_distance_destination_not_found_body():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, AddressNotFoundError],
    ):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "xyznonexistent"},
        )
    assert response.json() == {"detail": "Destination address not found"}


# ---------------------------------------------------------------------------
# Route tests — service error (503)
# ---------------------------------------------------------------------------


def test_distance_origin_service_error_returns_503():
    with patch(GEOCODE_MOCK, side_effect=[GeocodingServiceError]):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "London"},
        )
    assert response.status_code == 503


def test_distance_origin_service_error_body():
    with patch(GEOCODE_MOCK, side_effect=[GeocodingServiceError]):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "London"},
        )
    assert response.json() == {"detail": "Geocoding service unavailable"}


def test_distance_destination_service_error_returns_503():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, GeocodingServiceError],
    ):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "London"},
        )
    assert response.status_code == 503


def test_distance_destination_service_error_body():
    with patch(
        GEOCODE_MOCK,
        side_effect=[HAPPY_COORDS_ORIGIN, GeocodingServiceError],
    ):
        response = client.post(
            "/distance",
            json={"origin": "Mountain View", "destination": "London"},
        )
    assert response.json() == {"detail": "Geocoding service unavailable"}


# ---------------------------------------------------------------------------
# Route tests — wrong method
# ---------------------------------------------------------------------------


def test_distance_get_returns_405():
    response = client.get("/distance")
    assert response.status_code == 405


def test_distance_get_body():
    response = client.get("/distance")
    assert response.json() == {"detail": "Method Not Allowed"}
