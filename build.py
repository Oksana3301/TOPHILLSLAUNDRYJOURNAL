from pathlib import Path
import base64
root=Path(__file__).resolve().parent
public=root/'dist'
html=(public/'index.html').read_text()
for stylesheet in ('styles.css','design.css'):
    css=(public/stylesheet).read_text()
    html=html.replace('<link rel="stylesheet" href="'+stylesheet+'">','<style>'+css+'</style>')
for script in ('logic.js','sop-source.js','content.js','motion.js','app.js','access.js'):
    code=(public/script).read_text().replace('</script','<\\/script')
    html=html.replace('<script src="'+script+'"></script>','<script>'+code+'</script>')
image=base64.b64encode((public/'assets/laundry-basket.png').read_bytes()).decode()
html=html.replace('<script>','<script>window.TH_ASSET_BASKET="data:image/png;base64,'+image+'";</script><script>',1)
html=html.replace('href="style-tile.html"','href="Top-Hills-Co-Style-Tile.html"')
(root/'Top-Hills-Co.html').write_text(html)
print('Built Top-Hills-Co.html ('+str(len(html.encode()))+' bytes)')

tile=(public/'style-tile.html').read_text()
for stylesheet in ('styles.css','design.css'):
    tile=tile.replace('<link rel="stylesheet" href="'+stylesheet+'">','<style>'+(public/stylesheet).read_text()+'</style>')
tile=tile.replace('src="assets/laundry-basket.png"','src="data:image/png;base64,'+image+'"').replace('href="index.html"','href="Top-Hills-Co.html"')
(root/'Top-Hills-Co-Style-Tile.html').write_text(tile)
print('Built Top-Hills-Co-Style-Tile.html')
