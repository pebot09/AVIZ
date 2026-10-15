# Gera os ícones do app (tela inicial do iOS/Android e aba do navegador).
# Rodar: python3 scripts/gerar-icones.py
# Desenho: um "A" discreto em forma de casa (o espaço de cada cliente).
from PIL import Image, ImageDraw
import os

AZUL = (37, 99, 235)
BRANCO = (255, 255, 255)
# Traço em coordenadas de 512: paredes, telhado e a travessa do A.
CASA = [(176, 352), (176, 240), (256, 160), (336, 240), (336, 352)]
TRAVESSA = [(176, 284), (336, 284)]
ESPESSURA = 28

def desenhar(lado):
    k = 4  # supersampling para bordas lisas
    L = lado * k
    esc = L / 512
    img = Image.new('RGB', (L, L), AZUL)
    d = ImageDraw.Draw(img)
    w = round(ESPESSURA * esc)
    def linha(pts):
        p = [(x * esc, y * esc) for x, y in pts]
        d.line(p, fill=BRANCO, width=w, joint='curve')
        for x, y in (p[0], p[-1]):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=BRANCO)
    linha(CASA)
    linha(TRAVESSA)
    return img.resize((lado, lado), Image.LANCZOS)

pasta = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(pasta, exist_ok=True)
for nome, lado in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512), ('favicon-32.png', 32)]:
    desenhar(lado).save(os.path.join(pasta, nome), optimize=True)
print('ok')
