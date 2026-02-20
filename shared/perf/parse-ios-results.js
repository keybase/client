#!/usr/bin/env node
// Parse XCUITest xcresult performance metrics and print a readable summary.
//
// Usage: node parse-ios-results.js [path-to-ios-metrics.json]

const fs = require('fs')
const path = require('path')

const outputDir = path.join(__dirname, 'output')
const metricsPath = process.argv[2] || path.join(outputDir, 'ios-metrics.json')
const summaryPath = path.join(outputDir, 'ios-summary.json')

// Try to load summary
let summary
if (fs.existsSync(summaryPath)) {
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  } catch (_) {}
}

// Load metrics
if (!fs.existsSync(metricsPath)) {
  console.error(`File not found: ${metricsPath}`)
  console.error('Run the iOS perf tests first: ./run-ios-perf.sh')
  process.exit(1)
}

let metrics
try {
  metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'))
} catch (e) {
  console.error('Failed to parse JSON:', e.message)
  process.exit(1)
}

console.log('=== iOS Performance Test Results ===\n')

// Print summary info
if (summary) {
  console.log(`Result: ${summary.result}`)
  console.log(`Tests: ${summary.passedTests} passed, ${summary.failedTests} failed, ${summary.totalTestCount} total`)
  if (summary.devicesAndConfigurations?.[0]?.device) {
    const d = summary.devicesAndConfigurations[0].device
    console.log(`Device: ${d.deviceName} (${d.platform} ${d.osVersion})`)
  }
  console.log('')
}

// Print performance metrics
if (!Array.isArray(metrics) || metrics.length === 0) {
  console.log('No performance metrics found.')
  process.exit(0)
}

for (const test of metrics) {
  console.log(`Test: ${test.testIdentifier}`)

  for (const run of test.testRuns || []) {
    if (run.device) {
      console.log(`  Device: ${run.device.deviceName}`)
    }

    for (const m of run.metrics || []) {
      const values = m.measurements || []
      console.log(`  ${m.displayName} (${m.unitOfMeasurement}):`)

      if (values.length) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const stddev = Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length)
        const relStddev = (stddev / avg * 100).toFixed(1)

        console.log(`    avg: ${avg.toFixed(3)}, min: ${min.toFixed(3)}, max: ${max.toFixed(3)}`)
        console.log(`    stddev: ${stddev.toFixed(3)} (${relStddev}%)`)
        console.log(`    samples: [${values.map(n => n.toFixed(3)).join(', ')}]`)
        console.log(`    polarity: ${m.polarity}`)
      }
      console.log('')
    }
  }
}
