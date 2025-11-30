import uuid
from datetime import datetime, timezone
from typing import Sequence

import httpx
# from sqlalchemy import delete, select
# from sqlalchemy.ext.asyncio import AsyncSession

import asyncio

# from app import models
# from app.config import get_settings

# settings = get_settings()


async def _predict_labels(texts: Sequence[str]) -> list[int]:
    if not texts:
        return []
    payload = {"texts": list(texts)}
    base = "https://breathlessly-glowing-turnstone.cloudpub.ru".rstrip("/")
    url = f"{base}/predict"
    # try:
    async with httpx.AsyncClient(timeout=30, verify=False, follow_redirects=True) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
    # except httpx.HTTPError as exc:
    #     raise ValueError(f"Model service request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise ValueError("Model service returned invalid JSON.") from exc
    


result = asyncio.run(_predict_labels(["лол"]))  # список строк!
print(result)