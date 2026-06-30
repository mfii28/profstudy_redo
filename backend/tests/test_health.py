"""
Basic health check tests for the StudyMate API.
Run with: .venv/Scripts/python -m pytest tests/ -v
"""

from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)


def test_root_endpoint():
    """Root endpoint should return welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Welcome" in data["message"]


def test_health_endpoint():
    """Health endpoint should report status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "database" in data
    assert "storage_r2" in data


@pytest.mark.skip(reason="Requires live DB connection — run server manually and test with curl")
def test_courses_endpoint():
    """Public courses endpoint should return list."""
    response = client.get("/api/v1/courses/")
    assert response.status_code == 200
    data = response.json()
    assert "courses" in data
    assert isinstance(data["courses"], list)


@pytest.mark.skip(reason="Requires live DB connection — run server manually and test with curl")
def test_books_endpoint():
    """Public books endpoint should return list."""
    response = client.get("/api/v1/books/")
    assert response.status_code == 200
    data = response.json()
    assert "books" in data
    assert isinstance(data["books"], list)


def test_protected_endpoints_return_401():
    """Protected endpoints should require authentication."""
    protected_paths = [
        "/api/v1/users/profile",
        "/api/v1/admin/dashboard/stats",
        "/api/v1/admin/analytics/overview",
        "/api/v1/notifications/",
        "/api/v1/cart/",
        "/api/v1/enrollments/",
        "/api/v1/analytics/funnel",
        "/api/v1/session/",
    ]
    for path in protected_paths:
        response = client.get(path)
        assert response.status_code == 401, f"{path} should return 401, got {response.status_code}"
