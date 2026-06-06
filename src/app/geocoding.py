from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError, GeocoderTimedOut


class AddressNotFoundError(Exception):
    """Raised when the geocoder returns no result for the given address."""


class GeocodingServiceError(Exception):
    """Raised when the geocoder encounters a service or network error."""


def geocode_address(address: str) -> tuple[float, float]:
    """Return (latitude, longitude) for the given address string.

    Raises:
        AddressNotFoundError: if the geocoder finds no match.
        GeocodingServiceError: if the geocoder times out or raises a service error.
    """
    geocoder = Nominatim(user_agent="fastapi-geocode-service")
    try:
        location = geocoder.geocode(address)
    except (GeocoderServiceError, GeocoderTimedOut) as exc:
        raise GeocodingServiceError(str(exc)) from exc

    if location is None:
        raise AddressNotFoundError(f"No result for address: {address!r}")

    return location.latitude, location.longitude
