"""Testes para o endpoint de amamentação."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_bottle_feeding(client: AsyncClient):
    """Deve registrar mamadeira com ML ofertados e consumidos."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "bottle", "ml_offered": 100, "ml_consumed": 80},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["feeding_type"] == "bottle"
    assert data["ml_offered"] == 100
    assert data["ml_consumed"] == 80
    assert data["breast_side"] is None
    assert "recorded_at" in data
    assert "id" in data


@pytest.mark.asyncio
async def test_create_breast_feeding_left(client: AsyncClient):
    """Deve registrar amamentação no peito esquerdo."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "breast", "breast_side": "left"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["feeding_type"] == "breast"
    assert data["breast_side"] == "left"
    assert data["ml_offered"] is None


@pytest.mark.asyncio
async def test_create_breast_feeding_right(client: AsyncClient):
    """Deve registrar amamentação no peito direito."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "breast", "breast_side": "right"},
    )
    assert response.status_code == 201
    assert response.json()["breast_side"] == "right"


@pytest.mark.asyncio
async def test_create_breast_feeding_both(client: AsyncClient):
    """Deve registrar amamentação nos dois peitos."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "breast", "breast_side": "both"},
    )
    assert response.status_code == 201
    assert response.json()["breast_side"] == "both"


@pytest.mark.asyncio
async def test_bottle_without_ml_offered_fails(client: AsyncClient):
    """Mamadeira sem ML ofertados deve retornar erro de validação."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "bottle"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_breast_without_side_fails(client: AsyncClient):
    """Peito sem lado especificado deve retornar erro de validação."""
    response = await client.post(
        "/api/feeding",
        json={"feeding_type": "breast"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_feedings_by_date(client: AsyncClient):
    """Deve listar registros filtrados por data."""
    # Cria dois registros (data automática = hoje)
    await client.post(
        "/api/feeding",
        json={"feeding_type": "bottle", "ml_offered": 100, "ml_consumed": 90},
    )
    await client.post(
        "/api/feeding",
        json={"feeding_type": "breast", "breast_side": "left"},
    )

    from datetime import date
    today = date.today().isoformat()
    response = await client.get(f"/api/feeding?date={today}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_list_feedings_empty_date(client: AsyncClient):
    """Data sem registros deve retornar lista vazia."""
    response = await client.get("/api/feeding?date=2000-01-01")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_delete_feeding(client: AsyncClient):
    """Deve deletar um registro existente."""
    create_resp = await client.post(
        "/api/feeding",
        json={"feeding_type": "bottle", "ml_offered": 50, "ml_consumed": 50},
    )
    record_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/feeding/{record_id}")
    assert delete_resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_feeding_not_found(client: AsyncClient):
    """Deletar registro inexistente deve retornar 404."""
    response = await client.delete("/api/feeding/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_active_breast_none(client: AsyncClient):
    """GET /api/feeding/active deve retornar null se não houver amamentação ativa."""
    response = await client.get("/api/feeding/active")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_active_breast_flow(client: AsyncClient):
    """Deve iniciar, obter como ativa e finalizar amamentação de peito."""
    # 1. Inicia amamentação ativa no peito esquerdo
    start_resp = await client.post(
        "/api/feeding/start",
        json={"breast_side": "left"}
    )
    assert start_resp.status_code == 201
    start_data = start_resp.json()
    assert start_data["feeding_type"] == "Breast"
    assert start_data["breast_side"] == "left"
    assert start_data["end_time"] is None
    assert start_data["duration_min"] is None
    assert start_data["is_active"] is True
    record_id = start_data["id"]

    # 2. Verifica se ela aparece como ativa
    active_resp = await client.get("/api/feeding/active")
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data is not None
    assert active_data["id"] == record_id

    # 3. Finaliza a amamentação ativa
    end_resp = await client.patch(f"/api/feeding/{record_id}/end")
    assert end_resp.status_code == 200
    end_data = end_resp.json()
    assert end_data["end_time"] is not None
    assert end_data["duration_min"] is not None
    assert end_data["is_active"] is False

    # 4. Verifica se a busca por ativa agora retorna None
    active_resp_2 = await client.get("/api/feeding/active")
    assert active_resp_2.status_code == 200
    assert active_resp_2.json() is None
