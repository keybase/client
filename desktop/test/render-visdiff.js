/* @flow */

import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import {app, BrowserWindow, ipcMain} from 'electron'
import {resolveRoot, resolveRootAsURL} from '../resolve-root'
import dumbComponentMap from '../shared/dev/dumb-component-map.desktop'

const WORKER_COUNT = 10
const CANVAS_SIZE = 1000

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
  Object.keys(dumbComponentMap[key].mocks).forEach(mockKey => {
    toRender.push({key, mockKey})
  })
})

app.on('ready', () => {
  console.log('Starting visdiff rendering')

  let rendering = 0
  const total = toRender.length
  let count = 0

  function renderNext (target) {
    console.log('Rendering next. Remaining:', toRender.length, 'Currently rendering:', rendering)
    if (!toRender.length) {
      if (rendering === 0) {
        process.exit(0)
      }
      return
    }
    target.send('display', toRender.pop())
    rendering++
  }

  ipcMain.on('visdiff-ready', ev => {
    console.log('Worker ready:', ev.sender.getOwnerBrowserWindow().id)
    renderNext(ev.sender)
  })

  ipcMain.on('display-done', (ev, msg) => {
    const sender = ev.sender
    sender.getOwnerBrowserWindow().capturePage(msg.rect, img => {
      const filenameParts = [msg.key, msg.mockKey].map(s => _.words(s).join('_').replace(/[^\w_]/g, ''))
      const filename = filenameParts.join('-') + '.png'
      fs.writeFile(path.join(outputDir, filename), img.toPng(), err => {
        if (err) {
          console.log('Error writing image', err)
          process.exit(1)
        }
        count++
        console.log(`[${count} / ${total}] wrote ${filename}`)
        rendering--
        renderNext(sender)
      })
    })
  })

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  for (let i = 0; i < WORKER_COUNT; i++) {
    setTimeout(() => {
      console.log('Creating new worker window', i)
      const workerWin = new BrowserWindow({show: false, width: CANVAS_SIZE, height: CANVAS_SIZE})
      console.log('Created new worker window', i, 'window id:', workerWin.id)

      workerWin.on('ready-to-show', () => console.log('Worker window ready-to-show:', workerWin.id))
      workerWin.webContents.on('did-finish-load', () => console.log('Worker window did-finish-load:', workerWin.id))
      workerWin.webContents.on('did-fail-load', () => console.log('Worker window did-fail-load:', workerWin.id))
      workerWin.on('unresponsive', () => console.log('Worker window unresponsive:', workerWin.id))
      workerWin.on('responsive', () => console.log('Worker window responsive:', workerWin.id))
      workerWin.on('closed', () => console.log('Worker window closed:', workerWin.id))

      const workerURL = resolveRootAsURL('renderer', `index.html?src=${scriptPath}`)
      console.log('Loading worker', workerWin.id, workerURL)
      workerWin.loadURL(workerURL)
      console.log('Loaded worker', workerWin.id, workerURL)
    }, i * 150)
  }

  console.log('Worker startup queued')
})
