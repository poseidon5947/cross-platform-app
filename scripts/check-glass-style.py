"""Check the deployable suite skins stay identical. Run from the repository root."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
apps = ['Crew+ Waterproofing Team Tool', 'SOP+ Tool', 'Waterproofing+ Warehouse Wizard']
styles = [(root / app / 'src/liquid-glass.css').read_bytes() for app in apps]
assert all(style == styles[0] for style in styles), 'Liquid glass styles differ between apps'
print('All three liquid glass styles match.')
