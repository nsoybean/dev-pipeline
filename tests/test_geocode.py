from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.geocoding import AddressNotFoundError, GeocodingServiceError

client = TestClient(app)

MOCK_TARGET = "app.geocoding.geocode_address"


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_geocode_happy_path_returns_200():
    with patch(MOCK_TARGET, return_value=(37.422, -122.084)):
        response = client.post(
            "/geocode",
            json={"address": "1600 Amphitheatre Parkway, Mountain View, CA"},
        )
    assert response.status_code == 200


def test_geocode_happy_path_body():
    with patch(MOCK_TARGET, return_value=(37.422, -122.084)):
        response = client.post(
            "/geocode",
            json={"address": "1600 Amphitheatre Parkway, Mountain View, CA"},
        )
    assert response.json() == {"latitude": 37.422, "longitude": -122.084}


def test_geocode_happy_path_mock_called_once_with_address():
    with patch(MOCK_TARGET, return_value=(37.422, -122.084)) as mock_fn:
        client.post(
            "/geocode",
            json={"address": "1600 Amphitheatre Parkway, Mountain View, CA"},
        )
    mock_fn.assert_called_once_with(
        "1600 Amphitheatre Parkway, Mountain View, CA"
    )


# ---------------------------------------------------------------------------
# Missing address field
# ---------------------------------------------------------------------------

def test_geocode_missing_address_returns_422():
    response = client.post("/geocode", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Empty address
# ---------------------------------------------------------------------------

def test_geocode_empty_address_returns_400():
    with patch(MOCK_TARGET) as mock_fn:
        response = client.post("/geocode", json={"address": ""})
    assert response.status_code == 400


def test_geocode_empty_address_body():
    with patch(MOCK_TARGET):
        response = client.post("/geocode", json={"address": ""})
    assert response.json() == {"detail": "Address must not be empty"}


def test_geocode_empty_address_geocoder_not_called():
    with patch(MOCK_TARGET) as mock_fn:
        client.post("/geocode", json={"address": ""})
    mock_fn.assert_not_called()


# ---------------------------------------------------------------------------
# Whitespace-only address
# ---------------------------------------------------------------------------

def test_geocode_whitespace_address_returns_400():
    with patch(MOCK_TARGET) as mock_fn:
        response = client.post("/geocode", json={"address": "   "})
    assert response.status_code == 400


def test_geocode_whitespace_address_body():
    with patch(MOCK_TARGET):
        response = client.post("/geocode", json={"address": "   "})
    assert response.json() == {"detail": "Address must not be empty"}


def test_geocode_whitespace_address_geocoder_not_called():
    with patch(MOCK_TARGET) as mock_fn:
        client.post("/geocode", json={"address": "   "})
    mock_fn.assert_not_called()


# ---------------------------------------------------------------------------
# Address not found
# ---------------------------------------------------------------------------

def test_geocode_not_found_returns_404():
    with patch(MOCK_TARGET, side_effect=AddressNotFoundError):
        response = client.post(
            "/geocode", json={"address": "xyznonexistentplace12345"}
        )
    assert response.status_code == 404


def test_geocode_not_found_body():
    with patch(MOCK_TARGET, side_effect=AddressNotFoundError):
        response = client.post(
            "/geocode", json={"address": "xyznonexistentplace12345"}
        )
    assert response.json() == {"detail": "Address not found"}


# ---------------------------------------------------------------------------
# Geocoder service unavailable
# ---------------------------------------------------------------------------

def test_geocode_service_error_returns_503():
    with patch(MOCK_TARGET, side_effect=GeocodingServiceError):
        response = client.post("/geocode", json={"address": "Some Address"})
    assert response.status_code == 503


def test_geocode_service_error_body():
    with patch(MOCK_TARGET, side_effect=GeocodingServiceError):
        response = client.post("/geocode", json={"address": "Some Address"})
    assert response.json() == {"detail": "Geocoding service unavailable"}


# ---------------------------------------------------------------------------
# Wrong HTTP method
# ---------------------------------------------------------------------------

def test_geocode_get_returns_405():
    response = client.get("/geocode")
    assert response.status_code == 405


def test_geocode_get_body():
    response = client.get("/geocode")
    assert response.json() == {"detail": "Method Not Allowed"}
