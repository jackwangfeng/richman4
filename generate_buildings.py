#!/usr/bin/env python3
"""Generate beautiful detailed pseudo-3D building sprites for 大富翁4.

Creates high-quality isometric-style buildings with rich details.

Usage:
    pip install pillow
    python generate_buildings.py

Outputs PNG files to public/buildings/
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import math

OUTPUT_DIR = "public/buildings"
IMAGE_SIZE = 256


def adjust_brightness(hex_color: str, factor: float) -> str:
    """Adjust brightness of a hex color."""
    hex_color = hex_color.lstrip('#')
    r = int(int(hex_color[0:2], 16) * factor)
    g = int(int(hex_color[2:4], 16) * factor)
    b = int(int(hex_color[4:6], 16) * factor)
    r = max(0, min(255, r))
    g = max(0, min(255, g))
    b = max(0, min(255, b))
    return f'#{r:02x}{g:02x}{b:02x}'


def draw_gradient_polygon(draw: ImageDraw.Draw, points: list, color1: str, color2: str, vertical: bool = True):
    """Draw a polygon with gradient fill."""
    if len(points) < 3:
        return
    
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    height = max_y - min_y if max_y > min_y else 1
    
    for i in range(height):
        ratio = i / height
        r1, g1, b1 = int(color1[1:3], 16), int(color1[3:5], 16), int(color1[5:7], 16)
        r2, g2, b2 = int(color2[1:3], 16), int(color2[3:5], 16), int(color2[5:7], 16)
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        
        scan_y = min_y + i
        intersections = []
        for j in range(len(points)):
            p1 = points[j]
            p2 = points[(j + 1) % len(points)]
            if (p1[1] <= scan_y < p2[1]) or (p2[1] <= scan_y < p1[1]):
                if p1[1] != p2[1]:
                    x = p1[0] + (scan_y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1])
                    intersections.append(x)
        
        intersections.sort()
        for k in range(0, len(intersections) - 1, 2):
            if k + 1 < len(intersections):
                draw.line([(int(intersections[k]), scan_y), (int(intersections[k + 1]), scan_y)], 
                         fill=f'#{r:02x}{g:02x}{b:02x}')


def draw_detailed_window(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, lit: bool = True):
    """Draw a detailed window with frame and glass."""
    frame_color = '#4A4A4A'
    frame_inner = '#3A3A3A'
    
    draw.rectangle([x - 2, y - 2, x + w + 2, y + h + 2], fill=frame_color)
    
    if lit:
        glass_color = '#FFFDE7'
        glass_highlight = '#FFF9C4'
    else:
        glass_color = '#B3E5FC'
        glass_highlight = '#81D4FA'
    
    draw.rectangle([x, y, x + w, y + h], fill=glass_color)
    
    draw.line([(x, y), (x + w, y)], fill=glass_highlight, width=1)
    draw.line([(x, y), (x, y + h)], fill=glass_highlight, width=1)
    
    mid_x = x + w // 2
    mid_y = y + h // 2
    draw.line([(mid_x, y), (mid_x, y + h)], fill=frame_inner, width=2)
    draw.line([(x, mid_y), (x + w, mid_y)], fill=frame_inner, width=2)
    
    draw.rectangle([x - 1, y - 1, x + w + 1, y + h + 1], outline=frame_color, width=1)


def draw_detailed_door(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int):
    """Draw a detailed door with frame and handle."""
    frame_color = '#5D4037'
    door_color = '#8D6E63'
    door_highlight = '#A1887F'
    
    draw.rectangle([x - 3, y - 3, x + w + 3, y + h + 3], fill=frame_color)
    
    draw.rectangle([x, y, x + w, y + h], fill=door_color)
    draw.line([(x, y), (x, y + h)], fill=door_highlight, width=2)
    draw.line([(x, y), (x + w, y)], fill=door_highlight, width=1)
    
    panel_margin = w // 6
    panel_h = h // 3
    draw.rectangle([x + panel_margin, y + panel_margin, 
                   x + w - panel_margin, y + panel_h], 
                  outline=door_highlight, width=1)
    draw.rectangle([x + panel_margin, y + h - panel_h - panel_margin, 
                   x + w - panel_margin, y + h - panel_margin], 
                  outline=door_highlight, width=1)
    
    handle_x = x + w - 8
    handle_y = y + h // 2
    draw.ellipse([handle_x - 3, handle_y - 3, handle_x + 3, handle_y + 3], fill='#FFD700')
    draw.ellipse([handle_x - 2, handle_y - 2, handle_x + 2, handle_y + 2], fill='#FFC107')


def draw_decorative_roof(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, is_hotel: bool = False):
    """Draw a detailed roof with tiles or decorations."""
    if is_hotel:
        roof_base = '#B71C1C'
        roof_dark = '#7F0000'
        roof_light = '#D32F2F'
        
        draw.rectangle([x - 5, y - h, x + w + 5, y], fill=roof_base)
        
        tile_h = 8
        for i in range(h // tile_h):
            tile_y = y - h + i * tile_h
            offset = (i % 2) * 10
            for j in range(-1, w // 15 + 2):
                tile_x = x + j * 15 + offset - 5
                draw.rectangle([tile_x, tile_y, tile_x + 14, tile_y + tile_h - 1], 
                             fill=roof_dark if (i + j) % 2 == 0 else roof_light)
        
        draw.rectangle([x - 5, y - h, x + w + 5, y - h + 3], fill='#5D0000')
        
        for i in range(3):
            flag_x = x + w // 4 + i * w // 4
            flag_h = 15
            draw.line([(flag_x, y - h - 5), (flag_x, y - h - flag_h - 5)], fill='#8B4513', width=2)
            draw.polygon([
                (flag_x, y - h - flag_h - 5),
                (flag_x + 12, y - h - flag_h // 2 - 5),
                (flag_x, y - h - 5)
            ], fill='#FF5252')
    else:
        roof_base = '#5D4037'
        roof_dark = '#3E2723'
        roof_light = '#795548'
        
        points = [
            (x + w // 2, y - h),
            (x - 15, y),
            (x + w + 15, y),
        ]
        
        draw.polygon(points, fill=roof_base)
        
        tile_rows = h // 6
        for i in range(tile_rows):
            row_y = y - h + i * 6 + 3
            left_x = x + w // 2 - (h - i * 6) * 0.5
            right_x = x + w // 2 + (h - i * 6) * 0.5
            
            if i % 2 == 0:
                draw.line([(left_x, row_y), (right_x, row_y)], fill=roof_dark, width=2)
        
        draw.line([points[0], points[1]], fill=roof_dark, width=2)
        draw.line([points[0], points[2]], fill=roof_dark, width=2)
        
        chimney_w = 14
        chimney_h = 20
        chimney_x = x + int(w * 0.7)
        chimney_y = y - h + 10
        
        draw.rectangle([chimney_x, chimney_y - chimney_h, chimney_x + chimney_w, chimney_y + 5],
                      fill='#8D6E63', outline='#5D4037', width=2)
        draw.rectangle([chimney_x - 2, chimney_y - chimney_h - 3, chimney_x + chimney_w + 2, chimney_y - chimney_h],
                      fill='#795548')


def draw_building_floor(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, depth: int,
                        top_color: str, left_color: str, right_color: str, floor_num: int):
    """Draw a single floor of the building with 3D effect."""
    iso_angle = 0.4
    
    top_points = [
        (x, y),
        (x + w // 2, y - int(depth * iso_angle)),
        (x + w, y),
        (x + w // 2, y + int(depth * iso_angle)),
    ]
    
    left_points = [
        (x, y),
        (x + w // 2, y + int(depth * iso_angle)),
        (x + w // 2, y + h + int(depth * iso_angle)),
        (x, y + h),
    ]
    
    right_points = [
        (x + w, y),
        (x + w // 2, y + int(depth * iso_angle)),
        (x + w // 2, y + h + int(depth * iso_angle)),
        (x + w, y + h),
    ]
    
    left_gradient_top = adjust_brightness(left_color, 1.1)
    left_gradient_bottom = adjust_brightness(left_color, 0.9)
    draw_gradient_polygon(draw, left_points, left_gradient_top, left_gradient_bottom)
    
    right_gradient_top = adjust_brightness(right_color, 1.05)
    right_gradient_bottom = adjust_brightness(right_color, 0.85)
    draw_gradient_polygon(draw, right_points, right_gradient_top, right_gradient_bottom)
    
    draw.polygon(top_points, fill=top_color)
    
    draw.line(top_points + [top_points[0]], fill=adjust_brightness(top_color, 0.7), width=1)
    draw.line(left_points + [left_points[0]], fill=adjust_brightness(left_color, 0.6), width=1)
    draw.line(right_points + [right_points[0]], fill=adjust_brightness(right_color, 0.6), width=1)
    
    draw.line([(x, y), (x, y + h)], fill=adjust_brightness(left_color, 1.2), width=1)
    draw.line([(x, y), (x + w // 2, y - int(depth * iso_angle))], fill=adjust_brightness(top_color, 1.1), width=1)


def draw_balcony(draw: ImageDraw.Draw, x: int, y: int, w: int):
    """Draw a small balcony."""
    rail_h = 8
    rail_color = '#78909C'
    
    draw.rectangle([x, y, x + w, y + rail_h], outline=rail_color, width=2)
    for i in range(1, 4):
        rail_x = x + i * w // 4
        draw.line([(rail_x, y), (rail_x, y + rail_h)], fill=rail_color, width=1)


def draw_ac_unit(draw: ImageDraw.Draw, x: int, y: int):
    """Draw a small AC unit."""
    w, h = 12, 8
    draw.rectangle([x, y, x + w, y + h], fill='#E0E0E0', outline='#9E9E9E', width=1)
    for i in range(3):
        draw.line([(x + 2, y + 2 + i * 2), (x + w - 2, y + 2 + i * 2)], fill='#BDBDBD', width=1)


def generate_building_sprite(level: int, size: int = IMAGE_SIZE) -> Image.Image:
    """Generate a detailed pseudo-3D building sprite."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    is_hotel = (level == 5)
    building_levels = 5 if is_hotel else level
    
    center_x = size // 2
    base_y = int(size * 0.75)
    
    floor_height = int(size * 0.12)
    body_width = int(size * 0.45)
    depth = int(size * 0.12)
    
    if is_hotel:
        colors = {
            'top': '#E57373',
            'left': '#C62828', 
            'right': '#B71C1C',
            'accent': '#FFCDD2'
        }
    else:
        colors = {
            'top': '#A5D6A7',
            'left': '#4CAF50',
            'right': '#388E3C',
            'accent': '#C8E6C9'
        }
    
    shadow_offset = 8
    shadow_points = [
        (center_x - body_width // 2 + shadow_offset, base_y + floor_height),
        (center_x + body_width // 2 + shadow_offset + 10, base_y + floor_height),
        (center_x + body_width // 2 + shadow_offset + 20, base_y + floor_height + 15),
        (center_x - body_width // 2 + shadow_offset + 10, base_y + floor_height + 15),
    ]
    draw.polygon(shadow_points, fill=(0, 0, 0, 50))
    
    for floor in range(building_levels):
        floor_y = base_y - floor * floor_height
        
        brightness_factor = 1 - floor * 0.03
        top_color = adjust_brightness(colors['top'], brightness_factor)
        left_color = adjust_brightness(colors['left'], brightness_factor)
        right_color = adjust_brightness(colors['right'], brightness_factor)
        
        x = center_x - body_width // 2
        draw_building_floor(draw, x, floor_y, body_width, floor_height, depth,
                           top_color, left_color, right_color, floor)
        
        win_w = int(body_width * 0.15)
        win_h = int(floor_height * 0.5)
        win_y = floor_y + int(floor_height * 0.25)
        
        win_positions = [0.2, 0.5, 0.8] if is_hotel else [0.25, 0.65]
        
        for i, pos in enumerate(win_positions):
            win_x = x + int(body_width * pos)
            lit = (floor + i) % 3 != 0
            draw_detailed_window(draw, win_x, win_y, win_w, win_h, lit)
        
        if floor > 0 and floor % 2 == 0 and not is_hotel:
            balcony_x = x + int(body_width * 0.1)
            draw_balcony(draw, balcony_x, floor_y + floor_height - 3, int(body_width * 0.3))
        
        if floor == 1 and is_hotel:
            draw_ac_unit(draw, x + body_width - 18, floor_y + 5)
    
    roof_y = base_y - building_levels * floor_height
    roof_height = int(size * 0.1)
    draw_decorative_roof(draw, center_x - body_width // 2, roof_y, body_width, roof_height, is_hotel)
    
    door_w = int(body_width * 0.25)
    door_h = int(floor_height * 0.8)
    door_x = center_x - door_w // 2
    door_y = base_y + floor_height - door_h
    draw_detailed_door(draw, door_x, door_y, door_w, door_h)
    
    if is_hotel:
        sign_w = int(body_width * 0.6)
        sign_h = 14
        sign_x = center_x - sign_w // 2
        sign_y = roof_y - roof_height - sign_h - 5
        
        draw.rectangle([sign_x - 2, sign_y - 2, sign_x + sign_w + 2, sign_y + sign_h + 2],
                      fill='#FFD700', outline='#FFA000', width=2)
        draw.rectangle([sign_x, sign_y, sign_x + sign_w, sign_y + sign_h],
                      fill='#FFEB3B')
        
        try:
            from PIL import ImageFont
            font = ImageFont.load_default()
            draw.text((center_x, sign_y + sign_h // 2), "HOTEL", fill='#C62828', 
                     anchor='mm', font=font)
        except:
            pass
    
    return img


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Generating detailed pseudo-3D building sprites...")
    print(f"Output size: {IMAGE_SIZE}x{IMAGE_SIZE} pixels")
    print()
    
    building_names = {
        1: "精致小屋 (Cozy Cottage)",
        2: "双层洋房 (Two-story House)",
        3: "三层公寓 (Three-story Apartment)",
        4: "四层大厦 (Four-story Building)",
        5: "豪华酒店 (Luxury Hotel)"
    }
    
    for level in range(1, 6):
        img = generate_building_sprite(level, size=IMAGE_SIZE)
        output_path = os.path.join(OUTPUT_DIR, f"building_{level}.png")
        img.save(output_path)
        print(f"Generated: {output_path}")
        print(f"  Level {level}: {building_names[level]}")
    
    print(f"\nDone! Generated 5 detailed building sprites in {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
