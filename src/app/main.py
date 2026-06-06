from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app import geocoding
from app.geocoding import AddressNotFoundError, GeocodingServiceError

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


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
