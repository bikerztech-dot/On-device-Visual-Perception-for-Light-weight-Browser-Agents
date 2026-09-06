from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    # Create image with gradient background
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)
    
    # Gradient from #667eea to #764ba2
    for y in range(size):
        r = int(102 + (118 - 102) * y / size)
        g = int(126 + (75 - 126) * y / size)
        b = int(234 + (162 - 234) * y / size)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    
    # Draw lock icon
    lock_width = int(size * 0.5)
    lock_height = int(size * 0.6)
    lock_x = (size - lock_width) // 2
    lock_y = (size - lock_height) // 2
    
    # Lock body (white rectangle)
    body_y = lock_y + int(lock_height * 0.4)
    body_height = int(lock_height * 0.6)
    draw.rectangle([lock_x, body_y, lock_x + lock_width, body_y + body_height], fill='white')
    
    # Lock shackle (white arc)
    shackle_radius = int(lock_width * 0.35)
    shackle_center_x = size // 2
    shackle_center_y = lock_y + int(lock_height * 0.3)
    line_width = max(2, int(size * 0.1))
    
    # Draw shackle as thick arc using ellipse
    bbox = [
        shackle_center_x - shackle_radius,
        shackle_center_y - shackle_radius,
        shackle_center_x + shackle_radius,
        shackle_center_y + shackle_radius
    ]
    draw.arc(bbox, 180, 0, fill='white', width=line_width)
    
    img.save(filename, 'PNG')
    print(f'Created {filename}')

os.makedirs('/workspace/client/extension/icons', exist_ok=True)
create_icon(16, '/workspace/client/extension/icons/icon16.png')
create_icon(48, '/workspace/client/extension/icons/icon48.png')
create_icon(128, '/workspace/client/extension/icons/icon128.png')
print('All icons created successfully!')
