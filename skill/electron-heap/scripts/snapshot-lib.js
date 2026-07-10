// Shared V8 .heapsnapshot parsing + reverse-edge index.
// Snapshot format: {snapshot:{meta,node_count,edge_count}, nodes:[flat], edges:[flat], strings:[]}
// edges[to_node] is a byte-offset into nodes (divide by node field count for node index).
'use strict'
const fs = require('fs')

function load(file, {reverse = true} = {}) {
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'))
  const meta = snap.snapshot.meta
  const NF = meta.node_fields.length
  const EF = meta.edge_fields.length
  const nodeCount = snap.snapshot.node_count
  const edgeCount = snap.snapshot.edge_count
  const {nodes, edges, strings} = snap
  const nodeTypes = meta.node_types[0]
  const edgeTypes = meta.edge_types[0]

  const F = {
    type: meta.node_fields.indexOf('type'),
    name: meta.node_fields.indexOf('name'),
    id: meta.node_fields.indexOf('id'),
    self: meta.node_fields.indexOf('self_size'),
    edgeCount: meta.node_fields.indexOf('edge_count'),
    detached: meta.node_fields.indexOf('detachedness'), // -1 in older snapshots
  }
  const E = {
    type: meta.edge_fields.indexOf('type'),
    name: meta.edge_fields.indexOf('name_or_index'),
    to: meta.edge_fields.indexOf('to_node'),
  }

  // firstEdge[i] = index of node i's first out-edge
  const firstEdge = new Uint32Array(nodeCount + 1)
  {
    let e = 0
    for (let i = 0; i < nodeCount; i++) { firstEdge[i] = e; e += nodes[i * NF + F.edgeCount] }
    firstEdge[nodeCount] = e
  }

  let revStart = null, revEdge = null
  if (reverse) {
    const inDeg = new Uint32Array(nodeCount)
    for (let e = 0; e < edgeCount; e++) inDeg[edges[e * EF + E.to] / NF]++
    revStart = new Uint32Array(nodeCount + 1)
    for (let i = 0; i < nodeCount; i++) revStart[i + 1] = revStart[i] + inDeg[i]
    revEdge = new Uint32Array(edgeCount)
    const fill = Uint32Array.from(revStart.subarray(0, nodeCount))
    for (let i = 0; i < nodeCount; i++) {
      for (let e = firstEdge[i]; e < firstEdge[i + 1]; e++) revEdge[fill[edges[e * EF + E.to] / NF]++] = e
    }
  }

  const h = {
    snap, meta, NF, EF, nodeCount, edgeCount, nodes, edges, strings, nodeTypes, edgeTypes,
    F, E, firstEdge, revStart, revEdge,
    nodeName: i => strings[nodes[i * NF + F.name]],
    nodeType: i => nodeTypes[nodes[i * NF + F.type]],
    nodeId: i => nodes[i * NF + F.id],
    nodeSelf: i => nodes[i * NF + F.self],
    isDetached: i => F.detached >= 0 && nodes[i * NF + F.detached] === 1,
    edgeTo: e => edges[e * EF + E.to] / NF,
    edgeType: e => edgeTypes[edges[e * EF + E.type]],
    edgeLabel(e) {
      const t = edgeTypes[edges[e * EF + E.type]]
      const n = edges[e * EF + E.name]
      return t === 'element' || t === 'hidden' ? `[${n}]` : `${t}:${strings[n]}`
    },
    // from-node of edge e (binary search over firstEdge)
    edgeFrom(e) {
      let lo = 0, hi = nodeCount
      while (lo < hi) { const m = (lo + hi) >> 1; if (firstEdge[m + 1] <= e) lo = m + 1; else hi = m }
      return lo
    },
    // BFS shortest retainer path node -> GC root. Skips weak edges.
    // opts.avoid: array of substrings; retainer nodes whose name contains one are skipped
    //   (e.g. ['InspectorDOMAgent','DevToolsSession'] to see past DevTools' own retention)
    // opts.jsOnly: forbid native intermediate nodes (first hop from a native start is allowed)
    pathToRoot(start, {avoid = [], jsOnly = false, maxDepth = 50} = {}) {
      const prev = new Map()
      const visited = new Set([start])
      let frontier = [start]
      for (let d = 0; d < maxDepth; d++) {
        const next = []
        for (const n of frontier) {
          for (let r = revStart[n]; r < revStart[n + 1]; r++) {
            const e = revEdge[r]
            if (h.edgeType(e) === 'weak') continue
            const from = h.edgeFrom(e)
            if (visited.has(from)) continue
            const fname = h.nodeName(from)
            if (avoid.some(a => fname.includes(a))) continue
            if (jsOnly && h.nodeType(from) === 'native' && n !== start) continue
            visited.add(from)
            prev.set(from, {e, to: n})
            if (from === 0 || h.nodeType(from) === 'synthetic') {
              const parts = []
              let cur = from
              while (cur !== start) {
                const step = prev.get(cur)
                parts.push(`${h.nodeName(cur).slice(0, 90)}(${h.nodeType(cur)}) --${h.edgeLabel(step.e)}-->`)
                cur = step.to
              }
              parts.push(`${h.nodeName(start).slice(0, 90)}(${h.nodeType(start)}) id=${h.nodeId(start)}`)
              return parts.join('\n  ')
            }
            next.push(from)
          }
        }
        if (!next.length) break
        frontier = next
      }
      return '(no path found)'
    },
  }
  return h
}

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB'

module.exports = {load, mb}
