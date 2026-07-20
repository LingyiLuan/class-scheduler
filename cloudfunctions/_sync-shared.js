/**
 * 云函数各自独立部署，无法 require 上级目录的 _shared，
 * 因此上传部署前把 cloudfunctions/_shared 复制进每个函数目录的 ./_shared，
 * 函数内以 require('./_shared/xxx') 引用。
 *
 * 用法：pnpm sync:cloud（每次改动 _shared 后、上传部署前执行）。
 * 复制产物 cloudfunctions/<fn>/_shared/ 已在 .gitignore 中，只提交源 cloudfunctions/_shared。
 */
const fs = require('fs')
const path = require('path')

const root = __dirname
const sharedSrc = path.join(root, '_shared')
const ignore = new Set(['_shared', 'README.md', '_sync-shared.js'])

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

if (!fs.existsSync(sharedSrc)) {
  console.error('未找到 cloudfunctions/_shared 目录')
  process.exit(1)
}

let count = 0
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || ignore.has(entry.name)) continue
  const dest = path.join(root, entry.name, '_shared')
  fs.rmSync(dest, { recursive: true, force: true })
  copyDir(sharedSrc, dest)
  count++
  console.log(`✓ _shared → ${entry.name}/_shared`)
}
console.log(`已同步 _shared 到 ${count} 个云函数目录`)
