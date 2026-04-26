#!/usr/bin/env node
/* global __dirname, console, module, process, require */
// Unified perf baseline comparison — handles both iOS and desktop baseline dirs.
//
// iOS baseline:     maestro-fps.json + react-profiler.json
// Desktop baseline: desktop-fps.json (includes react data if available)
//
// Usage: node perf/compare-perf.js <baseline-a> <baseline-b>

const fs = require('fs')
const path = require('path')

const BASELINES_DIR = path.resolve(__dirname, 'baselines')

function resolveBaseline(arg) {
  if (path.isAbsolute(arg)) return arg
  return path.join(BASELINES_DIR, arg)
}

function loadBaseline(dir) {
  const perfFile = path.join(dir, 'perf.json')
  if (!fs.existsSync(perfFile)) return null
  const data = JSON.parse(fs.readFileSync(perfFile, 'utf8'))
  return {fps: data.fps, longTasks: data.longTasks ?? null, memory: data.memory ?? null, react: data.react ?? null}
}

function pct(oldVal, newVal) {
  if (!oldVal) return 'n/a'
  const diff = ((newVal - oldVal) / oldVal) * 100
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
}

function compareBaselines(aDir, bDir) {
  if (!fs.existsSync(aDir)) {
    console.error(`Baseline not found: ${aDir}`)
    process.exit(1)
  }
  if (!fs.existsSync(bDir)) {
    console.error(`Baseline not found: ${bDir}`)
    process.exit(1)
  }

  const aData = loadBaseline(aDir)
  const bData = loadBaseline(bDir)

  if (!aData) { console.error(`No recognized perf data in: ${aDir}`); process.exit(1) }
  if (!bData) { console.error(`No recognized perf data in: ${bDir}`); process.exit(1) }

  const aName = path.basename(aDir)
  const bName = path.basename(bDir)

  const rows = [['Metric', aName, bName, 'Change']]

  // FPS (both platforms)
  rows.push(
    ['FPS avg', String(aData.fps.avg), String(bData.fps.avg), pct(aData.fps.avg, bData.fps.avg)],
    ['FPS p5', String(aData.fps.p5), String(bData.fps.p5), pct(aData.fps.p5, bData.fps.p5)],
    ['FPS min', String(aData.fps.min), String(bData.fps.min), pct(aData.fps.min, bData.fps.min)]
  )

  // Long tasks (desktop only)
  if (aData.longTasks && bData.longTasks) {
    rows.push(
      ['Long tasks', String(aData.longTasks.count), String(bData.longTasks.count), pct(aData.longTasks.count, bData.longTasks.count)],
      ['Long task ms', String(aData.longTasks.totalMs), String(bData.longTasks.totalMs), pct(aData.longTasks.totalMs, bData.longTasks.totalMs)]
    )
  }

  // Memory (desktop only)
  if (aData.memory && bData.memory) {
    rows.push(
      ['Memory start', `${aData.memory.startHeapMB}MB`, `${bData.memory.startHeapMB}MB`, ''],
      ['Memory peak', `${aData.memory.peakHeapMB}MB`, `${bData.memory.peakHeapMB}MB`, ''],
      ['Memory end', `${aData.memory.endHeapMB}MB`, `${bData.memory.endHeapMB}MB`, '']
    )
  }

  // React totals (both platforms)
  if (aData.react && bData.react) {
    rows.push(
      ['React ms', String(aData.react.totalDurationMs), String(bData.react.totalDurationMs), pct(aData.react.totalDurationMs, bData.react.totalDurationMs)],
      ['React renders', String(aData.react.totalRenders), String(bData.react.totalRenders), pct(aData.react.totalRenders, bData.react.totalRenders)]
    )
  }

  const widths = rows[0].map((_, col) => Math.max(...rows.map(r => r[col].length)))
  const fmt = row => row.map((cell, i) => cell.padEnd(widths[i])).join('  ')
  const sep = widths.map(w => '-'.repeat(w)).join('  ')

  console.log(`\n=== Comparison: ${aName} vs ${bName} ===`)
  console.log(fmt(rows[0]))
  console.log(sep)
  for (const row of rows.slice(1)) console.log(fmt(row))

  // Per-component React table (both platforms)
  if (aData.react?.components && bData.react?.components) {
    const allIds = [...new Set([...Object.keys(aData.react.components), ...Object.keys(bData.react.components)])].sort()
    if (allIds.length) {
      console.log('')
      console.log(`${'Component'.padEnd(25)}  ${'old ms'.padStart(8)}  ${'new ms'.padStart(8)}  ${'change'.padStart(8)}   ${'old #'.padStart(6)}  ${'new #'.padStart(6)}`)
      console.log('-'.repeat(80))
      for (const id of allIds) {
        const ac = aData.react.components[id] ?? {mountCount: 0, totalMs: 0, updateCount: 0}
        const bc = bData.react.components[id] ?? {mountCount: 0, totalMs: 0, updateCount: 0}
        const oms = ac.totalMs
        const nms = bc.totalMs
        const ocnt = ac.mountCount + ac.updateCount
        const ncnt = bc.mountCount + bc.updateCount
        const change = oms > 0 ? `${(((nms - oms) / oms) * 100).toFixed(0)}%` : 'new'
        console.log(`${id.padEnd(25)}  ${String(oms).padStart(8)}  ${String(nms).padStart(8)}  ${change.padStart(8)}   ${String(ocnt).padStart(6)}  ${String(ncnt).padStart(6)}`)
      }
    }
  }
}

// Standalone CLI
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: node perf/compare-perf.js <baseline-a> <baseline-b>')
    process.exit(1)
  }
  compareBaselines(resolveBaseline(args[0]), resolveBaseline(args[1]))
}

module.exports = {compareBaselines, loadBaseline, resolveBaseline}
