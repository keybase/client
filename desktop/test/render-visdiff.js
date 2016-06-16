/* @flow */

import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import {app, BrowserWindow, ipcMain} from 'electron'
import {resolveRoot, resolveRootAsURL} from '../resolve-root'
import dumbComponentMap from '../shared/dev/dumb-component-map.desktop'

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
  const win = new BrowserWindow({show: false, width: 1000, height: 1000})

  function renderNext () {
    if (!toRender.length) {
      app.quit()
      return
    }
    win.webContents.send('display', toRender.pop())
  }

  ipcMain.on('display-done', (ev, msg) => {
    win.capturePage(msg.rect, img => {
      const filenameParts = [msg.key, msg.mockKey].map(s => _.words(s).join('_').replace(/[^\w_]/g, ''))
      const filename = filenameParts.join('-') + '.png'
      fs.writeFileSync(path.join(outputDir, filename), img.toPng())
      console.log('wrote', filename)
      renderNext()
    })
  })

  ipcMain.on('visdiff-ready', renderNext)

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  win.loadURL(resolveRootAsURL('renderer', `index.html?src=${scriptPath}`))
})
