#!/usr/bin/env node
/* global __dirname, console, process, require, setTimeout */
// CDP CPU profiler for the Keybase Electron app.
// Connects to the Chrome DevTools Protocol on localhost:9222,
// records a CPU profile, and saves a .cpuprofile file.
//
// Usage: node run-desktop-cdp-profile.js [--duration 5000] [--output path]
//
// No external dependencies — uses built-in http and ws (from node_modules).

const http = require('http')
const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(name)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}

const duration = parseInt(getArg('--duration', '5000'), 10)
const outputDir = path.resolve(__dirname, 'output')

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

const outputPath = getArg('--output', path.join(outputDir, `cpu-profile-${getTimestamp()}.cpuprofile`))

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, res => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

async function main() {
  // 1. Discover debugger targets
  console.log('Connecting to CDP on localhost:9222...')
  let targets
  try {
    targets = await fetchJSON('http://localhost:9222/json')
  } catch (e) {
    console.error('Failed to connect. Is the app running with KB_ENABLE_REMOTE_DEBUG=1?')
    console.error(e.message)
    process.exit(1)
  }

  // Find the main page (not DevTools, not service worker)
  const page = targets.find(t => t.type === 'page' && !t.url.includes('devtools://'))
  if (!page) {
    console.error(
      'No suitable page target found. Targets:',
      targets.map(t => ({title: t.title, type: t.type}))
    )
    process.exit(1)
  }

  console.log(`Target: "${page.title}" (${page.url})`)
  const wsUrl = page.webSocketDebuggerUrl
  if (!wsUrl) {
    console.error('No webSocketDebuggerUrl available for the target.')
    process.exit(1)
  }

  // 2. Connect via WebSocket
  const WebSocket = require('ws')
  const ws = new WebSocket(wsUrl)

  let msgId = 0
  const pending = new Map()

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId
      pending.set(id, {reject, resolve})
      ws.send(JSON.stringify({id, method, params}))
    })
  }

  ws.on('message', raw => {
    const msg = JSON.parse(raw)
    if (msg.id && pending.has(msg.id)) {
      const {resolve, reject} = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) {
        reject(new Error(msg.error.message))
      } else {
        resolve(msg.result)
      }
    }
  })

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  console.log('Connected to CDP WebSocket.')

  try {
    // 3. Enable profiler and start
    await send('Profiler.enable')
    await send('Profiler.setSamplingInterval', {interval: 100})
    await send('Profiler.start')
    console.log(`Profiling for ${duration}ms...`)

    await new Promise(resolve => setTimeout(resolve, duration))

    // 4. Stop and save
    const result = await send('Profiler.stop')
    const profile = result.profile

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputPath), {recursive: true})
    fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2))
    console.log(`CPU profile saved to: ${outputPath}`)
    console.log('Load this file in Chrome DevTools → Performance → Load profile')

    // 5. Optional: heap usage summary
    try {
      const heap = await send('Runtime.getHeapUsage')
      console.log(
        `Heap: used=${(heap.usedSize / 1024 / 1024).toFixed(1)}MB, total=${(heap.totalSize / 1024 / 1024).toFixed(1)}MB`
      )
    } catch (_e) {
      // Runtime.getHeapUsage may not be available
    }

    await send('Profiler.disable')
  } finally {
    ws.close()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
