// @flow

import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import {app, BrowserWindow, ipcMain} from 'electron'
import {resolveRoot, resolveRootAsURL} from '../resolve-root'
import dumbComponentMap from '../../dev/dumb-sheet/component-map.desktop'

const WORKER_COUNT = 10
const CANVAS_SIZE = 1000
const DEBUG_WINDOWS = false
const FILTER_KEY = ''

if (process.argv.length !== 3) {
  console.log(`Usage: electron ${path.basename(process.argv[1])} DESTINATION`)
  process.exit(1)
}
const outputDir = process.argv[2]
if (!fs.existsSync(outputDir)) {
  console.log(`Error: output dir ${outputDir} does not exist`)
  process.exit(1)
}

const toRender = []
Object.keys(dumbComponentMap).forEach(key => {
  if (FILTER_KEY && key !== FILTER_KEY) {
    return
  }
  Object.keys(dumbComponentMap[key].mocks).forEach(mockKey => {
    toRender.push({key, mockKey})
  })
})

app.on('ready', () => {
  console.log('Starting visdiff rendering')

  let rendering = 0
  const total = toRender.length
  let count = 0

  function renderNext(target) {
    console.log('Rendering next. Remaining:', toRender.length, 'Currently rendering:', rendering)
    if (!toRender.length) {
      if (rendering === 0) {
        if (!DEBUG_WINDOWS) {
          app.quit()
        }
      }
      return
    }
    target.send('display', toRender.pop())
    rendering++
  }

  ipcMain.on('display-done', (ev, msg) => {
    const sender = ev.sender
    sender.getOwnerBrowserWindow().capturePage(msg.rect, img => {
      const filenameParts = [msg.key, msg.mockKey].map(s => _.words(s).join('_').replace(/[^\w_]/g, ''))
      if (msg.isError) {
        filenameParts.push('ERROR')
      }
      const filename = filenameParts.join('-') + '.png'
      fs.writeFile(path.join(outputDir, filename), img.toPng(), err => {
        if (err) {
          console.log('Error writing image', err)
          app.exit(1)
        }
        count++
        if (msg.isError) {
          console.log(`[${count} / ${total}] error rendering: ${msg.key} - ${msg.mockKey}`)
        } else {
          console.log(`[${count} / ${total}] wrote ${filename}`)
        }
        rendering--
        renderNext(sender)
      })
    })
  })

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  for (let i = 0; i < WORKER_COUNT; i++) {
    setTimeout(() => {
      if (!toRender.length) {
        return
      }
      const firstDisplay = toRender.pop()

      console.log('Creating new worker window', i)
      const workerWin = new BrowserWindow({show: DEBUG_WINDOWS, width: CANVAS_SIZE, height: CANVAS_SIZE})
      console.log('Created new worker window', i)

      workerWin.on('ready-to-show', () => console.log('Worker window ready-to-show:', i))
      if (DEBUG_WINDOWS) {
        workerWin.webContents.openDevTools()
      }
      workerWin.webContents.on('did-finish-load', () => {
        if (DEBUG_WINDOWS) {
          workerWin.webContents.openDevTools('right')
        }

        console.log('Worker window did-finish-load:', i)
        workerWin.webContents.send('load', {
          scripts: [{src: scriptPath}],
          firstDisplay,
        })
        rendering++
      })
      workerWin.webContents.on('did-fail-load', () => console.log('Worker window did-fail-load:', i))
      workerWin.on('unresponsive', () => console.log('Worker window unresponsive:', i))
      workerWin.on('responsive', () => console.log('Worker window responsive:', i))
      workerWin.on('closed', () => console.log('Worker window closed:', i))

      const workerURL = resolveRootAsURL('renderer', `renderer.html?visDiff`)
      console.log('Loading worker', i, workerURL)
      workerWin.loadURL(workerURL)
      console.log('Loaded worker', i, workerURL)
    }, i * 150)
  }

  console.log('Worker startup queued')
})
