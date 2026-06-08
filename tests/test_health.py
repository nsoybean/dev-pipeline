from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import expected_project_version

client = TestClient(app)


def test_get_health_returns_200():
    response = client.get("/health")
    assert response.status_code == 200


def test_get_health_body():
    response = client.get("/health")
    assert response.json() == {
        "status": "ok",
        "version": expected_project_version(),
    }


def test_get_health_version_matches_pyproject():
    response = client.get("/health")
    assert response.json()["version"] == expected_project_version()


def test_get_health_content_type():
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]


def test_get_nonexistent_returns_404():
    response = client.get("/nonexistent")
    assert response.status_code == 404


def test_get_nonexistent_body():
    response = client.get("/nonexistent")
    assert response.json() == {"detail": "Not Found"}


def test_get_nonexistent_content_type():
    response = client.get("/nonexistent")
    assert "application/json" in response.headers["content-type"]


def test_post_health_returns_405():
    response = client.post("/health")
    assert response.status_code == 405


def test_post_health_body():
    response = client.post("/health")
    assert response.json() == {"detail": "Method Not Allowed"}


def test_post_health_content_type():
    response = client.post("/health")
    assert "application/json" in response.headers["content-type"]
