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
  let rendering = 0
  const total = toRender.length
  let count = 0

  function renderNext (target) {
    if (!toRender.length) {
      if (rendering === 0) {
        app.quit()
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
      const filename = filenameParts.join('-') + '.png'
      fs.writeFile(path.join(outputDir, filename), img.toPng(), err => {
        if (err) {
          console.log('Error writing image', err)
          app.exit(1)
        }
        count++
        console.log(`[${count} / ${total}] wrote ${filename}`)
        rendering--
        renderNext(sender)
      })
    })
  })

  ipcMain.on('visdiff-ready', ev => renderNext(ev.sender))

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  for (let i = 0; i < WORKER_COUNT; i++) {
    setTimeout(() => {
      const workerWin = new BrowserWindow({show: false, width: CANVAS_SIZE, height: CANVAS_SIZE})
      // TODO: once we're on electron v1.2.3, try ready-to-show event.
      workerWin.webContents.once('did-finish-load', () => renderNext(workerWin.webContents))
      workerWin.loadURL(resolveRootAsURL('renderer', `index.html?src=${scriptPath}`))
    }, i * 150)
  }
})
