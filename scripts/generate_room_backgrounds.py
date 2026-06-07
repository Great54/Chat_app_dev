"""Generate themed room background images for Philippines and Birthday rooms.

Writes two PNG files into /app/backend/static/room_backgrounds/ and prints the
public URLs for the server to seed.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT_DIR = Path("/app/backend/static/room_backgrounds")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    "philippines": (
        "A vibrant, light, colourful illustration of a Philippines tropical beach scene: "
        "palm trees, turquoise ocean, white sand, jeepney silhouettes in the distance, "
        "Filipino flag banderitas streaming across a clear blue sky, soft warm sunset light, "
        "no people, no text, painterly aesthetic, mobile chat room background, 1024x1024."
    ),
    "birthday": (
        "A cheerful, light, colourful illustration of a birthday celebration scene: "
        "a tall layered birthday cake with lit candles, pastel balloons floating up, "
        "confetti, party streamers, presents stacked on a soft pink table, dreamy bokeh background, "
        "no people, no text, painterly aesthetic, mobile chat room background, 1024x1024."
    ),
}


async def generate(name: str, prompt: str) -> str:
    api_key = os.environ["EMERGENT_LLM_KEY"]
    chat = (
        LlmChat(api_key=api_key, session_id=f"room-bg-{name}", system_message="Generate the requested image.")
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )
    msg = UserMessage(text=prompt)
    _, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise RuntimeError(f"No image generated for {name}")
    image_bytes = base64.b64decode(images[0]["data"])
    out_path = OUT_DIR / f"{name}.png"
    out_path.write_bytes(image_bytes)
    return str(out_path)


async def main():
    paths = {}
    for name, prompt in PROMPTS.items():
        print(f"Generating {name}…")
        path = await generate(name, prompt)
        print(f"  → saved to {path} ({Path(path).stat().st_size} bytes)")
        paths[name] = path
    return paths


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
