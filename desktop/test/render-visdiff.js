/* @flow */

import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import {app, BrowserWindow, ipcMain} from 'electron'
import {resolveRoot, resolveRootAsURL} from '../resolve-root'

const CANVAS_SIZE = 1500

if (process.argv.length !== 3) {
  console.log(`Usage: electron ${path.basename(process.argv[1])} DESTINATION`)
  process.exit(1)
}
const outputDir = process.argv[2]
if (!fs.existsSync(outputDir)) {
  console.log(`Error: output dir ${outputDir} does not exist`)
  process.exit(1)
}

app.on('ready', () => {
  const win = new BrowserWindow({show: false, width: CANVAS_SIZE, height: CANVAS_SIZE})

  ipcMain.on('display-visible', (ev, msg) => {
    const waiting = msg.items.map(item =>
      new Promise((resolve, reject) => {
        win.capturePage(item.rect, img => {
          const filenameParts = [item.key, item.mockKey].map(s => _.words(s).join('_').replace(/[^\w_]/g, ''))
          const filename = filenameParts.join('-') + '.png'
          fs.writeFile(path.join(outputDir, filename), img.toPng(), err => {
            if (err) {
              reject(err)
            }
            console.log('wrote', filename)
            resolve()
          })
        })
      })
    )

    Promise.all(waiting)
      .then(() => {
        // Not sure if screenshots are synchronous. Add a little fudge time for them to finish.
        setTimeout(() => {
          if (msg.done) {
            app.quit()
          } else {
            win.webContents.send('display-next')
          }
        }, 100)
      })
      .catch(err => {
        console.log('Error:', err)
        app.exit(1)
      })
  })

  ipcMain.on('display-error', (ev, msg) => {
    console.log('Error: ' + msg.err)
    app.exit(1)
  })

  const scriptPath = resolveRoot('dist', 'visdiff.bundle.js')
  win.loadURL(resolveRootAsURL('renderer', `index.html?src=${scriptPath}`))
})
