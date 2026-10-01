"""Config flow for HA Display."""

from __future__ import annotations

import ipaddress
from urllib.parse import urlsplit

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (
    API_PORT,
    CONFIG_UPDATED_SIGNAL,
    DEFAULT_START_URL,
    DOMAIN,
)

def _local_base_url(host: str, port: int) -> str | None:
    try:
        ip = ipaddress.ip_address(host.split("%", maxsplit=1)[0])
        if not (ip.is_private or ip.is_loopback or ip.is_link_local):
            return None
        rendered_host = f"[{host}]" if ip.version == 6 else host
    except ValueError:
        if not host.endswith(".local"):
            return None
        rendered_host = host
    if not 1 <= port <= 65535:
        return None
    return f"http://{rendered_host}:{port}"


def _valid_dashboard_url(value: str) -> bool:
    try:
        parsed = urlsplit(value.strip())
        valid = (
            parsed.scheme in ("http", "https")
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
        )
        if not valid:
            return False
        parsed.port
    except ValueError:
        return False
    return True


class HaDisplayConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up a discovered HA Display."""

    VERSION = 1

    async def async_step_zeroconf(self, discovery_info):
        """Handle a discovered display and prompt for its pairing PIN."""
        properties = discovery_info.properties
        self._device_id = properties.get("id")
        if not self._device_id:
            return self.async_abort(reason="invalid_discovery")
        await self.async_set_unique_id(self._device_id)

        self._base_url = _local_base_url(discovery_info.host, discovery_info.port)
        if self._base_url is None:
            return self.async_abort(reason="invalid_discovery")
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{self._base_url}/api/info", timeout=ClientTimeout(total=5)
            ) as response:
                if response.status != 200:
                    return self.async_abort(reason="cannot_connect")
                info = await response.json()
        except (ClientError, TimeoutError, ValueError):
            return self.async_abort(reason="cannot_connect")
        if not isinstance(info, dict) or info.get("device_id") != self._device_id:
            return self.async_abort(reason="invalid_discovery")
        self._display_name = info.get("name", "HA Display")
        existing_entry = next(
            (
                entry
                for entry in self.hass.config_entries.async_entries(DOMAIN)
                if entry.unique_id == self._device_id
            ),
            None,
        )
        if existing_entry is not None:
            host = urlsplit(self._base_url).hostname
            port = urlsplit(self._base_url).port or API_PORT
            if (
                existing_entry.data.get("host") != host
                or existing_entry.data.get("port") != port
            ):
                self.hass.config_entries.async_update_entry(
                    existing_entry,
                    data={**existing_entry.data, "host": host, "port": port},
                )
            return self.async_abort(reason="already_configured")
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input=None):
        """Confirm pairing using the PIN displayed by the device."""
        errors = {}
        if user_input is not None:
            session = async_get_clientsession(self.hass)
            try:
                async with session.post(
                    f"{self._base_url}/api/pair",
                    json={"pin": user_input["pin"].strip()},
                    timeout=ClientTimeout(total=5),
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if not isinstance(result, dict) or not isinstance(
                            result.get("token"), str
                        ):
                            errors["base"] = "cannot_connect"
                        else:
                            return self.async_create_entry(
                                title=f"{self._display_name} ({self._device_id})",
                                data={
                                    "device_id": self._device_id,
                                    "host": urlsplit(self._base_url).hostname,
                                    "port": urlsplit(self._base_url).port or API_PORT,
                                    "token": result["token"],
                                },
                            )
                    errors["base"] = {
                        401: "invalid_pin",
                        409: "already_paired",
                        410: "pin_expired",
                        429: "too_many_attempts",
                    }.get(response.status, "cannot_connect")
            except (ClientError, TimeoutError, ValueError, KeyError):
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="confirm",
            data_schema=vol.Schema(
                {
                    vol.Required("pin"): vol.All(
                        str, vol.Length(min=8, max=8), vol.Match(r"^\d{8}$")
                    )
                }
            ),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return HaDisplayOptionsFlow(config_entry)


class HaDisplayOptionsFlow(config_entries.OptionsFlow):
    """Manage the shared dashboard URL and an optional display override."""

    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        errors = {}
        domain_data = self.hass.data.get(DOMAIN, {})
        default_url = domain_data.get("default_url", DEFAULT_START_URL)
        if user_input is not None:
            default_url = user_input["default_url"].strip()
            display_url = user_input["dashboard_url"].strip()
            if not _valid_dashboard_url(default_url):
                errors["default_url"] = "invalid_url"
            if display_url and not _valid_dashboard_url(display_url):
                errors["dashboard_url"] = "invalid_url"
            if not errors:
                store: Store = domain_data["store"]
                await store.async_save({"url": default_url})
                domain_data["default_url"] = default_url
                async_dispatcher_send(self.hass, CONFIG_UPDATED_SIGNAL)
                return self.async_create_entry(
                    title="",
                    data={"dashboard_url": display_url},
                )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required("default_url", default=default_url): str,
                    vol.Optional(
                        "dashboard_url",
                        default=self.config_entry.options.get("dashboard_url", ""),
                    ): str,
                }
            ),
            errors=errors,
        )
