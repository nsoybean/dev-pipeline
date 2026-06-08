from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app import geocoding
from app.geocoding import AddressNotFoundError, GeocodingServiceError
from app.version import APP_VERSION

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION}


class GeocodeRequest(BaseModel):
    address: str


class GeocodeResponse(BaseModel):
    latitude: float
    longitude: float


@app.post("/geocode", response_model=GeocodeResponse)
def geocode(body: GeocodeRequest):
    if not body.address.strip():
        raise HTTPException(status_code=400, detail="Address must not be empty")

    try:
        lat, lon = geocoding.geocode_address(body.address)
    except AddressNotFoundError:
        raise HTTPException(status_code=404, detail="Address not found")
    except GeocodingServiceError:
        raise HTTPException(status_code=503, detail="Geocoding service unavailable")

    return GeocodeResponse(latitude=lat, longitude=lon)


class DistanceRequest(BaseModel):
    origin: str
    destination: str


class DistanceResponse(BaseModel):
    distance_km: float


@app.post("/distance", response_model=DistanceResponse)
def distance(body: DistanceRequest):
    if not body.origin.strip():
        raise HTTPException(status_code=400, detail="Origin address must not be empty")
    if not body.destination.strip():
        raise HTTPException(status_code=400, detail="Destination address must not be empty")

    try:
        lat1, lon1 = geocoding.geocode_address(body.origin)
    except AddressNotFoundError:
        raise HTTPException(status_code=404, detail="Origin address not found")
    except GeocodingServiceError:
        raise HTTPException(status_code=503, detail="Geocoding service unavailable")

    try:
        lat2, lon2 = geocoding.geocode_address(body.destination)
    except AddressNotFoundError:
        raise HTTPException(status_code=404, detail="Destination address not found")
    except GeocodingServiceError:
        raise HTTPException(status_code=503, detail="Geocoding service unavailable")

    km = geocoding.distance_between(lat1, lon1, lat2, lon2)
    return DistanceResponse(distance_km=km)
