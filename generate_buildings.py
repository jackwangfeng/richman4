#!/usr/bin/env python3
"""Generate building sprites for 大富翁4.

Creates house and hotel images in the style of classic Monopoly.

Usage:
    pip install pillow
    python generate_buildings.py

Outputs PNG files to public/buildings/
"""

from PIL import Image, ImageDraw
import os

OUTPUT_DIR = "public/buildings"


def draw_house(draw: ImageDraw.Draw, x: int, y: int, size: int, color: str = "#2e7d32"):
    """Draw a single house at position (x, y)."""
    # House body (rectangle)
    body_h = int(size * 0.5)
    body_w = int(size * 0.7)
    body_x = x - body_w // 2
    body_y = y + int(size * 0.1)

    # Roof (triangle)
    roof_h = int(size * 0.4)
    roof_points = [
        (x, y - roof_h + int(size * 0.1)),  # top
        (body_x - 2, body_y),  # bottom left
        (body_x + body_w + 2, body_y),  # bottom right
    ]

    # Draw roof
    draw.polygon(roof_points, fill="#8B4513", outline="#5D3A1A")

    # Draw body
    draw.rectangle(
        [body_x, body_y, body_x + body_w, body_y + body_h],
        fill=color,
        outline="#1B5E20"
    )

    # Draw door
    door_w = int(body_w * 0.3)
    door_h = int(body_h * 0.6)
    door_x = x - door_w // 2
    door_y = body_y + body_h - door_h
    draw.rectangle(
        [door_x, door_y, door_x + door_w, body_y + body_h],
        fill="#5D3A1A",
        outline="#3E2723"
    )


def draw_hotel(draw: ImageDraw.Draw, x: int, y: int, size: int):
    """Draw a hotel at position (x, y)."""
    # Hotel body (taller rectangle)
    body_h = int(size * 0.7)
    body_w = int(size * 0.8)
    body_x = x - body_w // 2
    body_y = y - int(size * 0.1)

    # Draw body
    draw.rectangle(
        [body_x, body_y, body_x + body_w, body_y + body_h],
        fill="#c62828",
        outline="#8B0000"
    )

    # Draw roof
    roof_h = int(size * 0.15)
    draw.rectangle(
        [body_x - 2, body_y - roof_h, body_x + body_w + 2, body_y],
        fill="#8B0000",
        outline="#5D0000"
    )

    # Draw windows (2x2 grid)
    win_size = int(body_w * 0.2)
    win_gap = int(body_w * 0.15)
    win_start_x = body_x + win_gap
    win_start_y = body_y + int(body_h * 0.15)

    for row in range(2):
        for col in range(2):
            wx = win_start_x + col * (win_size + win_gap)
            wy = win_start_y + row * (win_size + win_gap)
            draw.rectangle(
                [wx, wy, wx + win_size, wy + win_size],
                fill="#FFEB3B",
                outline="#FBC02D"
            )

    # Draw door
    door_w = int(body_w * 0.25)
    door_h = int(body_h * 0.3)
    door_x = x - door_w // 2
    door_y = body_y + body_h - door_h
    draw.rectangle(
        [door_x, door_y, door_x + door_w, body_y + body_h],
        fill="#5D3A1A",
        outline="#3E2723"
    )


def generate_building_sprite(level: int, size: int = 32) -> Image.Image:
    """Generate a building sprite for the given level (1-5)."""
    # Create transparent image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if level == 5:
        # Hotel
        draw_hotel(draw, size // 2, size // 2, size)
    elif level == 1:
        # Single house centered
        draw_house(draw, size // 2, size // 2, size)
    elif level == 2:
        # Two houses side by side
        house_size = int(size * 0.6)
        draw_house(draw, size // 3, size // 2 + 2, house_size)
        draw_house(draw, 2 * size // 3, size // 2 + 2, house_size)
    elif level == 3:
        # Three houses in triangle formation
        house_size = int(size * 0.5)
        draw_house(draw, size // 2, size // 3, house_size)
        draw_house(draw, size // 4, 2 * size // 3, house_size)
        draw_house(draw, 3 * size // 4, 2 * size // 3, house_size)
    elif level == 4:
        # Four houses in 2x2 grid
        house_size = int(size * 0.45)
        positions = [
            (size // 3, size // 3),
            (2 * size // 3, size // 3),
            (size // 3, 2 * size // 3),
            (2 * size // 3, 2 * size // 3),
        ]
        for px, py in positions:
            draw_house(draw, px, py, house_size)

    return img


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Generate building sprites for levels 1-5
    for level in range(1, 6):
        img = generate_building_sprite(level, size=48)
        output_path = os.path.join(OUTPUT_DIR, f"building_{level}.png")
        img.save(output_path)
        print(f"Generated: {output_path}")

    print(f"\nDone! Generated 5 building sprites.")


if __name__ == "__main__":
    main()
