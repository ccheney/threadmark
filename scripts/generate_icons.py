import os
from PIL import Image

source_icon = 'assets/threadmark-512.png'
output_dir = 'dist/assets'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

sizes = [16, 48, 128]

try:
    img = Image.open(source_icon)
    for size in sizes:
        output_path = os.path.join(output_dir, f'icon-{size}.png')
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        resized_img.save(output_path)
        print(f"Generated {output_path}")
except Exception as e:
    print(f"Error generating icons: {e}")
    exit(1)
