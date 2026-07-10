#!/usr/bin/env node
// Overview stats for a V8/Electron .heapsnapshot:
// node type aggregates, top constructors by size/count, detached DOM summary,
// big strings, Error/closure hotspots.
// Usage: node --max-old-space-size=8192 heap-stats.js <file.heapsnapshot>
'use strict'
const {load, mb} = require('./snapshot-lib')

const file = process.argv[2]
if (!file) { console.error('usage: heap-stats.js <file.heapsnapshot>'); process.exit(1) }
console.error('loading (no reverse index needed)...')
const h = load(file, {reverse: false})

const byName = new Map()
const typeAgg = new Map()
const detachedNames = new Map()
let detachedCount = 0, detachedSize = 0
const bigStrings = []

for (let i = 0; i < h.nodeCount; i++) {
  const type = h.nodeType(i)
  const name = h.nodeName(i)
  const self = h.nodeSelf(i)

  let t = typeAgg.get(type)
  if (!t) typeAgg.set(type, t = {count: 0, size: 0})
  t.count++; t.size += self

  if (type === 'object' || type === 'closure' || type === 'native') {
    const key = type === 'closure' ? 'closure:' + name : name
    let e = byName.get(key)
    if (!e) byName.set(key, e = {count: 0, size: 0})
    e.count++; e.size += self
  }

  if (h.isDetached(i)) {
    detachedCount++; detachedSize += self
    let d = detachedNames.get(name)
    if (!d) detachedNames.set(name, d = {count: 0, size: 0})
    d.count++; d.size += self
  }

  if ((type === 'string' || type === 'concatenated string') && self > 100000) {
    bigStrings.push({name: name.slice(0, 120), size: self})
  }
}

console.log('=== totals ===')
console.log(`nodes=${h.nodeCount} edges=${h.edgeCount}`)
console.log('\n=== by node type ===')
for (const [k, v] of [...typeAgg].sort((a, b) => b[1].size - a[1].size)) console.log(`${k}: count=${v.count} size=${mb(v.size)}`)
console.log('\n=== top 40 constructors by total self size ===')
for (const [k, v] of [...byName].sort((a, b) => b[1].size - a[1].size).slice(0, 40)) console.log(`${k}: count=${v.count} size=${mb(v.size)}`)
console.log('\n=== top 40 constructors by count ===')
for (const [k, v] of [...byName].sort((a, b) => b[1].count - a[1].count).slice(0, 40)) console.log(`${k}: count=${v.count} size=${mb(v.size)}`)
console.log(`\n=== detached DOM: ${detachedCount} nodes, self size ${mb(detachedSize)} ===`)
for (const [k, v] of [...detachedNames].sort((a, b) => b[1].count - a[1].count).slice(0, 25)) console.log(`count=${v.count} ${k.slice(0, 140)}`)
console.log('\n=== strings > 100KB ===')
for (const s of bigStrings.sort((a, b) => b.size - a.size).slice(0, 20)) console.log(`${mb(s.size)}: ${JSON.stringify(s.name)}`)
