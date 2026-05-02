"""
/health liveness + readiness — DB probe ve security headers.
Hardening commit (2026-05-03) ile eklenen yeni davranışları doğrular.
"""


def test_health_ok(client):
    """DB ulaşılabilirken /health 200 + db=ok döner."""
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["db"] == "ok"
    assert body["version"] == "3.1.0"


def test_health_response_has_security_headers(client):
    """security_headers middleware /health üzerinde de uygulanmalı."""
    res = client.get("/health")
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    csp = res.headers.get("Content-Security-Policy", "")
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
    # Deprecated header artık eklenmemeli (OWASP önerisi)
    assert "X-XSS-Protection" not in res.headers
    # HSTS korunuyor
    assert "max-age=31536000" in res.headers.get("Strict-Transport-Security", "")
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
