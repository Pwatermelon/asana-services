#!/usr/bin/env python3
"""Собирает config.json для sing-box из ссылки vless:// (как в v2rayN / Happ)."""
from __future__ import annotations

import json
import os
import sys
from urllib.parse import parse_qs, unquote, urlparse


def _first(params: dict, key: str, default: str | None = None) -> str | None:
    v = params.get(key)
    if not v:
        return default
    return unquote(v[0]) if v[0] else default


def parse_vless(uri: str) -> dict:
    raw = (uri or "").strip()
    if not raw:
        raise ValueError("VLESS_URI пустой")
    if raw.startswith("vless://"):
        raw = raw[8:]
    elif "://" in raw:
        raise ValueError("Ожидается ссылка vless://...")

    # uuid@host:port?query#remark
    if "@" not in raw:
        raise ValueError("Некорректная ссылка: нет uuid@server")
    userinfo, rest = raw.split("@", 1)
    uuid = unquote(userinfo)
    if "#" in rest:
        rest, _remark = rest.split("#", 1)
    if "?" in rest:
        hostpart, query = rest.split("?", 1)
    else:
        hostpart, query = rest, ""
    params = parse_qs(query, keep_blank_values=True)

    if ":" in hostpart:
        host, port_s = hostpart.rsplit(":", 1)
        port = int(port_s)
    else:
        host = hostpart
        port = 443

    security = (_first(params, "security") or "none").lower()
    net_type = (_first(params, "type") or "tcp").lower()
    flow = _first(params, "flow")
    sni = _first(params, "sni") or _first(params, "host") or host
    fp = _first(params, "fp") or "chrome"
    allow_insecure = _first(params, "allowInsecure", "0") in ("1", "true", "yes")

    outbound: dict = {
        "type": "vless",
        "tag": "proxy",
        "server": host,
        "server_port": port,
        "uuid": uuid,
    }
    if flow:
        outbound["flow"] = flow

    if security in ("tls", "reality"):
        tls: dict = {
            "enabled": True,
            "server_name": sni,
            "insecure": allow_insecure,
        }
        if fp:
            tls["utls"] = {"enabled": True, "fingerprint": fp}
        if security == "reality":
            pbk = _first(params, "pbk")
            sid = _first(params, "sid") or ""
            if not pbk:
                raise ValueError("Для reality нужен параметр pbk в ссылке")
            tls["reality"] = {
                "enabled": True,
                "public_key": pbk,
                "short_id": sid,
            }
        outbound["tls"] = tls

    if net_type == "ws":
        path = _first(params, "path") or "/"
        ws_host = _first(params, "host") or sni
        outbound["transport"] = {
            "type": "ws",
            "path": path,
            "headers": {"Host": ws_host},
        }
    elif net_type == "grpc":
        service_name = _first(params, "serviceName") or _first(params, "path") or ""
        outbound["transport"] = {
            "type": "grpc",
            "service_name": service_name,
        }
    elif net_type == "http":
        path = _first(params, "path") or "/"
        outbound["transport"] = {"type": "http", "path": path, "host": [_first(params, "host") or sni]}

    return outbound


def build_config(outbound: dict, listen_port: int) -> dict:
    return {
        "log": {"level": "warn"},
        "inbounds": [
            {
                "type": "http",
                "tag": "http-in",
                "listen": "0.0.0.0",
                "listen_port": listen_port,
            }
        ],
        "outbounds": [
            outbound,
            {"type": "direct", "tag": "direct"},
        ],
        "route": {
            "rules": [{"inbound": ["http-in"], "outbound": "proxy"}],
            "final": "direct",
        },
    }


def main() -> None:
    uri = os.environ.get("VLESS_URI", "").strip()
    port = int(os.environ.get("TELEGRAM_PROXY_PORT", "8888"))
    try:
        outbound = parse_vless(uri)
        print(json.dumps(build_config(outbound, port), indent=2))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
