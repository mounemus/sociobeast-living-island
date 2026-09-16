#!/usr/bin/env bash
# Builds ONE self-contained HTML (CSS, JS and the GLB model inlined) — for claude.ai artifacts, itch.io, e-mail, USB…
set -e
cd "$(dirname "$0")/.."
mkdir -p web/dist
python3 - << 'PY'
import base64, re
html = open('web/index.html').read()
css = open('server/assets/style.css').read() + "\n" + open('server/assets/game.css').read()
html = re.sub(r'<link rel="stylesheet" href="assets/style.css">', '<style>' + css.replace('</style>','<\\/style>') + '</style>', html)
html = re.sub(r'\s*<link rel="stylesheet" href="assets/game.css[^"]*">', '', html)
mock = open('web/mock-api.js').read()
html = html.replace('<script src="mock-api.js?v=1"></script>', '<script>' + mock.replace('</script>','<\\/script>') + '</script>')
glb = base64.b64encode(open('server/assets/kodama.glb','rb').read()).decode()
bundle = "\n;\n".join(open('server/assets/' + f).read() for f in ['visualEngine.js','speech.js','ui.js','app.js','gameEngine.js'])
bundle = bundle.replace('</script>', '<\\/script>')
html = html.replace("window.INITIAL_STATE = null;", "window.INITIAL_STATE = null;\n        window.ART_BASE = 'https://cdn.jsdelivr.net/gh/mounemus/sociobeast-living-island@main/server/assets/art/';\n        window.KODAMA_GLB_URL = 'data:model/gltf-binary;base64," + glb + "';")
# replace the sequential script loader by an inline bundle runner
html = re.sub(r"var scripts = \[.*?loadNext\(\);", "try { (new Function(document.getElementById('sb-bundle').textContent))(); } catch (e) { window._loadLog('Bundle error: ' + e.message); console.error(e); }", html, flags=re.S)
html = html.replace('</body>', '<script type="text/plain" id="sb-bundle">' + bundle + '</script>\n</body>')
open('web/dist/sociobeast-standalone.html','w').write(html)
print('standalone:', round(len(html)/1024), 'KB')
PY
