"""Run one live /api/analyze against the FastAPI app in-process.

No server needed: the script drives the ASGI app directly with httpx.

    uv run python scripts/e2e_analyze.py --health-only   # print plan, spend nothing
    uv run python scripts/e2e_analyze.py                 # full 8-agent run (~2 min)
    uv run python scripts/e2e_analyze.py --idea "..." --timeout 500

A full run needs real keys in agents/.env and spends a complete crew run's
worth of tokens; use --health-only to check wiring for free.
"""

import argparse
import asyncio
import json
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")  # before importing main, which reads the keys

import httpx

import main as api


async def run(idea: str, timeout: float, health_only: bool) -> None:
    transport = httpx.ASGITransport(app=api.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        health = (await client.get("/health")).json()
        print("providers:", health["providers"])
        print("tier plan:")
        for key, model in sorted(health["models"].items()):
            print(f"  {key:12s} -> {model}")
        if health_only:
            return

        start = time.time()
        resp = await client.post(
            "/api/analyze",
            json={"idea": idea},
            headers={"X-Student-Id": "e2e"},
            timeout=timeout,
        )
        elapsed = round(time.time() - start, 1)
        print(f"status: {resp.status_code} in {elapsed}s")

        if resp.status_code != 200:
            print("detail:", json.dumps(resp.json(), indent=2))
            sys.exit(1)

        body = resp.json()
        report = body["report"]
        print(
            "report chars:", len(report),
            "| analysis_id:", body["analysis_id"],
            "| from_cache:", body["from_cache"],
        )
        print("token_usage:", body.get("token_usage"))
        print("--- report head ---")
        print(report[:600])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Drive /api/analyze in-process with a live crew run."
    )
    parser.add_argument(
        "--idea",
        default="A mobile app that helps college students form study groups",
    )
    parser.add_argument("--timeout", type=float, default=400, help="POST timeout in seconds")
    parser.add_argument(
        "--health-only",
        action="store_true",
        help="print providers and the tier plan, then exit without spending tokens",
    )
    args = parser.parse_args()
    asyncio.run(run(args.idea, args.timeout, args.health_only))


if __name__ == "__main__":
    main()
