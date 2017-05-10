// @flow
const fs = require('fs')
const path = require('path')

if (process.argv.length < 2) {
  console.log('Usage: node make-shim YOUR_MODULE_NAME')
  process.exit(1)
}

const mod = process.argv[2]
const root = path.join('node_modules', mod)

try {
  fs.mkdirSync(root)
} catch (_) {}

try {
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `{
  "main": "index.js"
}
`
  )
} catch (_) {}

try {
  fs.writeFileSync(
    path.join(root, 'index.js'),
    `module.exports = null // Generated shim-module
`
  )
} catch (_) {}
