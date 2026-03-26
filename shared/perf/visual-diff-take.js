#!/usr/bin/env node
// Takes screenshots of all 8 desktop app tabs via Chrome DevTools Protocol.
// Usage: node visual-diff-take.js <baseline|current>
//
// Prerequisites:
//   - App running with: KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot
//   - Run from shared/ directory (needs node_modules/ws)

const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const http = require('http')

const CDP_PORT = 9222
const TABS = ['people', 'chat', 'files', 'crypto', 'teams', 'git', 'devices', 'settings']
// Keyboard shortcut numbers for each tab (⌘1 through ⌘8)
const TAB_KEYS = {chat: '2', crypto: '4', devices: '7', files: '3', git: '6', people: '1', settings: '8', teams: '5'}
const SETTLE_MS = 1500

const mode = process.argv[2]
if (mode !== 'baseline' && mode !== 'current') {
  console.log('Usage: node visual-diff-take.js <baseline|current>')
  console.log('  baseline  — capture base branch screenshots')
  console.log('  current   — capture feature branch screenshots')
  process.exit(1)
}

const outDir = path.join('/tmp', 'visual-diff', mode)
fs.mkdirSync(outDir, {recursive: true})

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function getMainPageWs() {
  const raw = await httpGet(`http://localhost:${CDP_PORT}/json`)
  const pages = JSON.parse(raw)
  const main = pages.find(p => p.title.startsWith('Keybase') && !p.url.includes('menubar') && p.type === 'page')
  if (!main) throw new Error('No main app page found. Is the app running with KB_ENABLE_REMOTE_DEBUG=1?')
  return main.webSocketDebuggerUrl
}

function connectWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function cdpSend(ws, method, params) {
  if (!ws._cdpId) ws._cdpId = 1
  return new Promise((resolve, reject) => {
    const id = ws._cdpId++
    const handler = msg => {
      const data = JSON.parse(msg)
      if (data.id === id) {
        ws.off('message', handler)
        if (data.error) reject(new Error(data.error.message))
        else resolve(data.result)
      }
    }
    ws.on('message', handler)
    ws.send(JSON.stringify({id, method, params: params || {}}))
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function pressKey(ws, key) {
  // Simulate Cmd+<key> via CDP Input.dispatchKeyEvent
  const modifiers = 4 // Meta (Cmd)
  await cdpSend(ws, 'Input.dispatchKeyEvent', {
    code: `Digit${key}`, key, modifiers, type: 'keyDown', windowsVirtualKeyCode: 48 + parseInt(key),
  })
  await cdpSend(ws, 'Input.dispatchKeyEvent', {
    code: `Digit${key}`, key, modifiers, type: 'keyUp', windowsVirtualKeyCode: 48 + parseInt(key),
  })
}

async function main() {
  console.log(`Taking ${mode} screenshots...`)
  console.log(`Output: ${outDir}/\n`)

  const wsUrl = await getMainPageWs()
  const ws = await connectWs(wsUrl)

  for (const tab of TABS) {
    const key = TAB_KEYS[tab]
    await pressKey(ws, key)
    await sleep(SETTLE_MS)

    const result = await cdpSend(ws, 'Page.captureScreenshot', {format: 'png'})
    const outFile = path.join(outDir, `${tab}.png`)
    fs.writeFileSync(outFile, Buffer.from(result.data, 'base64'))
    console.log(`  ${tab} -> ${outFile}`)
  }

  ws.close()
  console.log(`\nDone. Screenshots in ${outDir}/`)
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
