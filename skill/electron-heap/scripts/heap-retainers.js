#!/usr/bin/env node
// Retainer analysis for nodes in a V8/Electron .heapsnapshot.
// Selects nodes by name substring (plus --detached / --type filters), then for each sample:
// direct retainers, shortest retainer path to GC root, optional property peek.
//
// Usage:
//   node --max-old-space-size=8192 heap-retainers.js <file.heapsnapshot> <name-substring> [options]
// Options:
//   --detached          only detached DOM nodes
//   --type=object       node type filter (object|native|closure|string|...)
//   --samples=N         how many matching nodes to analyze (default 4, spread across matches)
//   --avoid=a,b         skip retainer nodes whose name contains any substring
//                       (use --avoid=InspectorDOMAgent,DevToolsSession,DocumentState to see
//                        app-level retention past DevTools/Blink-history anchors)
//   --js-only           forbid native intermediates in root path (find pure-JS retention)
//   --props             dump property/context edges of each sample (message, stack, etc.)
'use strict'
const {load} = require('./snapshot-lib')

const args = process.argv.slice(2)
const file = args[0]
const needle = args[1]
if (!file || needle === undefined) {
  console.error('usage: heap-retainers.js <file.heapsnapshot> <name-substring> [--detached] [--type=T] [--samples=N] [--avoid=a,b] [--js-only] [--props]')
  process.exit(1)
}
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const flag = k => args.includes(`--${k}`)
const wantDetached = flag('detached')
const typeFilter = opt('type')
const nSamples = +(opt('samples') || 4)
const avoid = (opt('avoid') || '').split(',').filter(Boolean)
const jsOnly = flag('js-only')
const wantProps = flag('props')

console.error('loading + building reverse index...')
const h = load(file)

const matches = []
for (let i = 0; i < h.nodeCount; i++) {
  if (typeFilter && h.nodeType(i) !== typeFilter) continue
  if (wantDetached && !h.isDetached(i)) continue
  if (needle && !h.nodeName(i).includes(needle)) continue
  matches.push(i)
}
console.log(`matches: ${matches.length}`)
const step = Math.max(1, Math.floor(matches.length / nSamples))
const samples = matches.filter((_, idx) => idx % step === 0).slice(0, nSamples)

for (const s of samples) {
  console.log(`\n===== ${h.nodeName(s).slice(0, 110)} (${h.nodeType(s)}) id=${h.nodeId(s)} detached=${h.isDetached(s)} =====`)
  console.log('direct retainers:')
  const seen = new Map()
  for (let r = h.revStart[s]; r < h.revStart[s + 1]; r++) {
    const e = h.revEdge[r]
    const from = h.edgeFrom(e)
    const k = `${h.nodeName(from).slice(0, 80)}(${h.nodeType(from)}) via ${h.edgeLabel(e)}`
    seen.set(k, (seen.get(k) || 0) + 1)
  }
  for (const [k, c] of [...seen].slice(0, 15)) console.log(`  <- ${k}${c > 1 ? ' x' + c : ''}`)
  if (wantProps) {
    console.log('out edges (property/context/internal):')
    let shown = 0
    for (let e = h.firstEdge[s]; e < h.firstEdge[s + 1] && shown < 20; e++) {
      const t = h.edgeType(e)
      if (t !== 'property' && t !== 'context' && t !== 'internal' && t !== 'shortcut') continue
      const to = h.edgeTo(e)
      console.log(`  ${h.edgeLabel(e)} -> ${h.nodeName(to).slice(0, 120)}(${h.nodeType(to)})`)
      shown++
    }
  }
  console.log('shortest path to root' + (avoid.length ? ` (avoiding ${avoid.join(',')})` : '') + (jsOnly ? ' (js-only)' : '') + ':')
  console.log('  ' + h.pathToRoot(s, {avoid, jsOnly}))
}
