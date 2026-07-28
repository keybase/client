// Builds the msgpack corpus the JSI conversion benchmark replays.
//
// Input is a real Metro dev log from a mobile run (shared/.expo/dev/logs/start.log),
// which contains every RPC payload the app received while printRPC was on. Each
// "IN >>" line ends with the console-printed first param of one incoming RPC.
// Those payloads are the actual traffic the bridge converts, so the benchmark
// measures the shapes and sizes that really occur rather than invented ones.
//
// Metro's console serializer elides objects past its depth limit as [Object] /
// [Array]; those lines cannot be reconstructed faithfully and are dropped. The
// script reports how much of the observed volume survived.
//
// Output is a length-prefixed stream of msgpack frames, encoded with the same
// @msgpack/msgpack the JS side uses, in the same 0xce + uint32 framing the
// transport writes:
//   [0xce][len:u32be][msgpack([type, seqid, method, [param]])]
//
// Usage:
//   node rnmodules/react-native-kb/scripts/make-bench-corpus.mjs \
//     [shared/.expo/dev/logs/start.log] [/tmp/kb-bench-corpus.bin]

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import {fileURLToPath} from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const {encode} = await import(
  path.join(repoRoot, 'shared/node_modules/@msgpack/msgpack/dist.esm/index.mjs')
)

const logPath = process.argv[2] ?? path.join(repoRoot, 'shared/.expo/dev/logs/start.log')
const outPath = process.argv[3] ?? '/tmp/kb-bench-corpus.bin'

// "IN >>keybase.1.foo.bar[-calling] [-calling] keybase.1.foo.bar {...}"
const lineRe = /^IN >>([A-Za-z0-9._]+)\[[^\]]*\]\s+\[[^\]]*\]\s+[A-Za-z0-9._]+(?:\s+(\{[\s\S]*\}))?$/

const stats = {elided: 0, noParam: 0, parsed: 0, total: 0, unparsable: 0}
const byMethod = new Map()
const frames = []

const rl = readline.createInterface({crlfDelay: Infinity, input: fs.createReadStream(logPath)})
for await (const raw of rl) {
  if (!raw.includes('IN >>')) continue
  let entry
  try {
    entry = JSON.parse(raw)
  } catch {
    continue
  }
  const text = entry?.data?.[0]
  if (typeof text !== 'string') continue
  const m = lineRe.exec(text)
  if (!m) continue
  const [, method, paramText] = m
  stats.total++
  const seen = byMethod.get(method) ?? {kept: 0, seen: 0}
  seen.seen++
  byMethod.set(method, seen)

  if (!paramText) {
    // Methods that really do take no argument still cross the bridge, but an
    // empty frame measures nothing. Skip rather than pad the corpus.
    stats.noParam++
    continue
  }
  if (paramText.includes('[Object]') || paramText.includes('[Array]')) {
    stats.elided++
    continue
  }
  let param
  try {
    param = JSON.parse(paramText)
  } catch {
    stats.unparsable++
    continue
  }
  stats.parsed++
  seen.kept++
  // Wire shape of an incoming call: [type=0, seqid, method, [param]].
  frames.push(encode([0, stats.parsed, method, [param]]))
}

const out = []
let bytes = 0
for (const payload of frames) {
  const header = Buffer.alloc(5)
  header[0] = 0xce
  header.writeUInt32BE(payload.length, 1)
  out.push(header, Buffer.from(payload))
  bytes += payload.length
}
fs.writeFileSync(outPath, Buffer.concat(out))

const keptVolume = [...byMethod.values()].reduce((n, v) => n + v.kept, 0)
console.log(`corpus: ${outPath}`)
console.log(`  frames        ${frames.length}`)
console.log(`  payload bytes ${bytes} (mean ${Math.round(bytes / Math.max(1, frames.length))})`)
console.log(
  `  from          ${stats.total} incoming RPCs in ${path.relative(repoRoot, logPath)} ` +
    `(${((100 * keptVolume) / Math.max(1, stats.total)).toFixed(1)}% kept)`
)
console.log(
  `  dropped       ${stats.elided} depth-elided, ${stats.noParam} no-param, ${stats.unparsable} unparsable`
)
console.log('  top methods kept:')
;[...byMethod.entries()]
  .sort((a, b) => b[1].kept - a[1].kept)
  .slice(0, 12)
  .forEach(([name, v]) => console.log(`    ${String(v.kept).padStart(5)}  ${name}`))
