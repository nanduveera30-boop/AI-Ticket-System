def test_register(client):
    res = client.post("/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "password123",
        "role": "agent",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "newuser"
    assert data["role"] == "agent"
    assert "hashed_password" not in data


def test_register_duplicate(client):
    payload = {"username": "dupuser", "email": "dup@example.com", "password": "pass1234", "role": "agent"}
    client.post("/auth/register", json=payload)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 409


def test_login_success(client):
    client.post("/auth/register", json={
        "username": "loginuser", "email": "login@example.com",
        "password": "mypassword", "role": "agent",
    })
    res = client.post("/auth/token", json={"username": "loginuser", "password": "mypassword"})
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert res.json()["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "username": "wrongpass", "email": "wp@example.com",
        "password": "correct", "role": "agent",
    })
    res = client.post("/auth/token", json={"username": "wrongpass", "password": "wrong"})
    assert res.status_code == 401


def test_me_endpoint(client, auth_headers):
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "testuser"


def test_protected_without_token(client):
    res = client.get("/tickets")
    assert res.status_code == 401
