/* @flow */

import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import {app, BrowserWindow, ipcMain} from 'electron'
import {resolveRoot, resolveRootAsURL} from '../resolve-root'
import dumbComponentMap from '../shared/more/dumb-component-map.desktop'

const outputDir = resolveRoot('screenshots')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir)
}

const toRender = []
Object.keys(dumbComponentMap).forEach(key => {
  if (key === 'Tracker') {
    // FIXME: Tracker dumb components aren't fully stateless yet
    return
  }
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
      const filenameParts = [msg.key, msg.mockKey].map(s => _.words(s).join('_'))
      const filename = filenameParts.join('-') + '.png'
      fs.writeFileSync(path.join(outputDir, filename), img.toPng())
      console.log('wrote', filename)
      renderNext()
    })
  })

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  win.loadURL(resolveRootAsURL('renderer', `index.html?src=${scriptPath}`))
  win.webContents.on('did-finish-load', renderNext)
})
