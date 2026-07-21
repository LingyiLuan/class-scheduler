#!/usr/bin/env bash
# 重新子集霞鹜文楷 → 内嵌进 src/styles/fonts.scss。
# 界面固定文案增删后运行本脚本，让手写体覆盖到新字。动态内容（学员名等）不走此字体。
# 依赖：python3 + fonttools + brotli（pip install fonttools brotli）
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=scratch_tmp
mkdir -p "$TMP"

# 1. 提取源码中「会渲染」的中文（剥掉注释）+ 常用中文标点
python3 - <<'PY'
import re, glob
cjk = re.compile(r'[一-鿿]')
def strip_comments(t, ext):
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    if ext in ('ts','tsx'):
        t = re.sub(r'(?m)//.*$', '', t)
    return t
chars=set()
for ext in ('tsx','ts','scss'):
    for f in glob.glob(f'src/**/*.{ext}', recursive=True):
        for ch in strip_comments(open(f,encoding='utf-8').read(), ext):
            if cjk.match(ch): chars.add(ch)
chars.update('、。，·—–…「」『』（）：；！？％／')
open('scratch_tmp/chars.txt','w',encoding='utf-8').write(''.join(sorted(chars)))
print('chars:', len(chars))
PY

# 2. 若无字体源，下载 LXGW WenKai Regular
if [ ! -f "$TMP/WenKai-Regular.ttf" ]; then
  url=$(curl -s https://api.github.com/repos/lxgw/LxgwWenKai/releases/latest \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(a['browser_download_url'] for a in d['assets'] if a['name']=='LXGWWenKai-Regular.ttf'))")
  curl -sL -o "$TMP/WenKai-Regular.ttf" "$url"
fi

# 3. 子集化 → woff2
pyftsubset "$TMP/WenKai-Regular.ttf" --text-file="$TMP/chars.txt" --unicodes=U+0020-007E \
  --flavor=woff2 --layout-features='' --no-hinting --desubroutinize \
  --output-file="$TMP/WenKai-subset.woff2"

# 4. base64 写回 fonts.scss（替换 WenKai @font-face 的 src）
python3 - <<'PY'
import base64, re, os
b64 = base64.b64encode(open('scratch_tmp/WenKai-subset.woff2','rb').read()).decode()
p='src/styles/fonts.scss'; s=open(p,encoding='utf-8').read()
s = re.sub(r"(font-family: 'WenKai';.*?src: url\('data:font/woff2;base64,)[^']*(')",
           lambda m: m.group(1)+b64+m.group(2), s, flags=re.S)
open(p,'w',encoding='utf-8').write(s)
print('embedded woff2:', round(os.path.getsize('scratch_tmp/WenKai-subset.woff2')/1024,1), 'KB')
PY
echo "done."
