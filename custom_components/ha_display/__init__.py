"""Home Assistant integration for HA Display."""

from __future__ import annotations

import logging

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.storage import Store

from .const import (
    CONFIG_UPDATED_SIGNAL,
    DEFAULT_START_URL,
    DEFAULT_URL_STORE_KEY,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)
STORAGE_VERSION = 1


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    store = Store(hass, STORAGE_VERSION, DEFAULT_URL_STORE_KEY)
    stored = await store.async_load()
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["default_url"] = (
        stored.get("url", DEFAULT_START_URL) if isinstance(stored, dict) else DEFAULT_START_URL
    )
    hass.data[DOMAIN]["store"] = store
    return True


async def _async_sync_display(hass: HomeAssistant, entry: ConfigEntry) -> None:
    default_url = hass.data[DOMAIN].get("default_url", DEFAULT_START_URL)
    dashboard_url = entry.options.get("dashboard_url") or default_url
    session = async_get_clientsession(hass)
    url = f"http://{entry.data['host']}:{entry.data['port']}/api/config"
    try:
        async with session.put(
            url,
            json={"dashboard_url": dashboard_url},
            headers={"Authorization": "Bearer " + str(entry.data["token"])},
            timeout=ClientTimeout(total=5),
        ) as response:
            if response.status != 204:
                _LOGGER.warning(
                    "Display %s rejected its configuration update (HTTP %s)",
                    entry.title,
                    response.status,
                )
    except (ClientError, TimeoutError):
        _LOGGER.warning("Could not send settings to display %s", entry.title)


async def _async_sync_all_displays(hass: HomeAssistant) -> None:
    for entry in hass.config_entries.async_entries(DOMAIN):
        await _async_sync_display(hass, entry)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async def sync_all() -> None:
        await _async_sync_all_displays(hass)

    entry.async_on_unload(
        async_dispatcher_connect(hass, CONFIG_UPDATED_SIGNAL, sync_all)
    )
    await _async_sync_display(hass, entry)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
