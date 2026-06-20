"""Test that stub endpoints now perform actual database operations."""
from fastapi import status


def test_delete_artisan_persists_deletion(client, db_session):
    """Test that DELETE /artisans/{id} actually deletes from database."""
    from app.core.security import get_password_hash
    from app.models.artisan import Artisan
    from app.models.user import User

    user = User(
        email="artisan_to_delete@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="Artisan To Delete",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    artisan = Artisan(
        user_id=user.id,
        description="Test artisan",
        hourly_rate=50.0,
        is_available=True,
    )
    db_session.add(artisan)
    db_session.commit()
    db_session.refresh(artisan)

    artisan_id = artisan.id

    # Create the admin user
    admin_user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPass1!"),
        role="admin",
        full_name="Admin User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()

    # Login as admin
    login_data = {"email": "admin@example.com", "password": "AdminPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Delete the artisan
    response = client.delete(f"api/v1/artisans/{artisan_id}", headers=headers)
    assert response.status_code == status.HTTP_200_OK

    # Verify deletion by querying database
    deleted_artisan = db_session.query(Artisan).filter(Artisan.id == artisan_id).first()
    assert deleted_artisan is None, "Artisan should be deleted from database"


def test_delete_artisan_returns_404_when_not_found(client, db_session):
    """Test that DELETE /artisans/{id} returns 404 when artisan doesn't exist."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Create admin user for authentication
    admin_user = User(
        email="admin2@example.com",
        hashed_password=get_password_hash("AdminPass1!"),
        role="admin",
        full_name="Admin User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()

    # Login as admin
    login_data = {"email": "admin2@example.com", "password": "AdminPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Try to delete non-existent artisan
    response = client.delete("api/v1/artisans/99999", headers=headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_artisan_returns_403_for_non_admin(client, db_session):
    """Test that DELETE /artisans/{id} returns 403 for non-admin users."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Create a user and artisan
    user = User(
        email="client@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="client",
        full_name="Client User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    # Login as client
    login_data = {"email": "client@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Try to delete artisan as client
    response = client.delete("api/v1/artisans/1", headers=headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_availability_update_persists_to_database(client, db_session):
    """Test that PUT /artisans/availability updates is_available in database."""
    from app.core.security import get_password_hash
    from app.models.artisan import Artisan
    from app.models.user import User

    # Create a user and artisan
    user = User(
        email="artisan_avail@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="Artisan User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    artisan = Artisan(
        user_id=user.id,
        description="Test artisan",
        hourly_rate=50.0,
        is_available=True,
    )
    db_session.add(artisan)
    db_session.commit()
    db_session.refresh(artisan)

    # Login as artisan
    login_data = {"email": "artisan_avail@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Update availability to False
    update_data = {"is_available": False}
    response = client.put(
        "api/v1/artisans/availability", json=update_data, headers=headers
    )
    assert response.status_code == status.HTTP_200_OK

    # Verify database was updated
    db_session.refresh(artisan)
    assert artisan.is_available is False, "is_available should be updated in database"


def test_availability_update_returns_404_when_artisan_not_found(client, db_session):
    """Test that availability update returns 404 when artisan profile doesn't exist."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Create a user without artisan profile
    user = User(
        email="no_artisan@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="No Artisan User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    # Login as user
    login_data = {"email": "no_artisan@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Try to update availability
    update_data = {"is_available": False}
    response = client.put(
        "api/v1/artisans/availability", json=update_data, headers=headers
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_portfolio_creation_persists_to_database(client, db_session):
    """Test that POST /artisans/portfolio/add creates real portfolio records."""
    from app.core.security import get_password_hash
    from app.models.artisan import Artisan
    from app.models.portfolio import Portfolio
    from app.models.user import User

    # Create a user and artisan
    user = User(
        email="portfolio@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="Portfolio User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    artisan = Artisan(
        user_id=user.id,
        description="Test artisan",
        hourly_rate=50.0,
        is_available=True,
    )
    db_session.add(artisan)
    db_session.commit()
    db_session.refresh(artisan)

    # Login as artisan
    login_data = {"email": "portfolio@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Add portfolio item
    portfolio_data = {
        "title": "Test Project",
        "image_url": "https://example.com/image.jpg",
    }
    response = client.post(
        "api/v1/artisans/portfolio/add", json=portfolio_data, headers=headers
    )
    assert response.status_code == status.HTTP_201_CREATED

    # Verify portfolio item was created in database
    portfolio_item = (
        db_session.query(Portfolio)
        .filter(Portfolio.artisan_id == artisan.id, Portfolio.title == "Test Project")
        .first()
    )
    assert portfolio_item is not None, "Portfolio item should be created in database"
    assert portfolio_item.image == "https://example.com/image.jpg"


def test_portfolio_retrieval_returns_stored_records(client, db_session):
    """Test that GET /artisans/my-portfolio returns stored portfolio records."""
    from app.core.security import get_password_hash
    from app.models.artisan import Artisan
    from app.models.portfolio import Portfolio
    from app.models.user import User

    # Create a user and artisan
    user = User(
        email="portfolio_get@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="Portfolio Get User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    artisan = Artisan(
        user_id=user.id,
        description="Test artisan",
        hourly_rate=50.0,
        is_available=True,
    )
    db_session.add(artisan)
    db_session.commit()
    db_session.refresh(artisan)

    # Create portfolio items directly in database
    item1 = Portfolio(
        artisan_id=artisan.id,
        title="Project 1",
        image="https://example.com/image1.jpg",
    )
    item2 = Portfolio(
        artisan_id=artisan.id,
        title="Project 2",
        image="https://example.com/image2.jpg",
    )
    db_session.add(item1)
    db_session.add(item2)
    db_session.commit()

    # Login as artisan
    login_data = {"email": "portfolio_get@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Get portfolio
    response = client.get("api/v1/artisans/my-portfolio", headers=headers)
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert "portfolio_items" in data
    assert len(data["portfolio_items"]) == 2, "Should return 2 portfolio items"

    # Verify the items match what we created
    titles = [item["title"] for item in data["portfolio_items"]]
    assert "Project 1" in titles
    assert "Project 2" in titles


def test_portfolio_retrieval_returns_empty_list_when_no_records(client, db_session):
    """Test that GET /artisans/my-portfolio returns empty list when no records exist."""
    from app.core.security import get_password_hash
    from app.models.artisan import Artisan
    from app.models.user import User

    # Create a user and artisan with no portfolio
    user = User(
        email="empty_portfolio@example.com",
        hashed_password=get_password_hash("StrongPass1!"),
        role="artisan",
        full_name="Empty Portfolio User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    artisan = Artisan(
        user_id=user.id,
        description="Test artisan",
        hourly_rate=50.0,
        is_available=True,
    )
    db_session.add(artisan)
    db_session.commit()

    # Login as artisan
    login_data = {"email": "empty_portfolio@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Get portfolio
    response = client.get("api/v1/artisans/my-portfolio", headers=headers)
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert "portfolio_items" in data
    assert (
        len(data["portfolio_items"]) == 0
    ), "Should return empty list when no records exist"
