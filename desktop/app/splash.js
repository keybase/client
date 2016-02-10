// Checks to see if we've launched before (we touch started.txt). If not, write the file and open a browser
import {splashRoot} from '../shared/constants/platform.native.desktop'
import {help} from '../shared/constants/urls'
import path from 'path'

const filePath = path.join(splashRoot, 'started.txt')
import fs from 'fs'
import {shell} from 'electron'

export default () => {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      try {
        fs.writeFileSync(filePath, 'This file gets created on first run of the app')
      } catch (e) {
        console.error(`Couldn't mark splash screen shown: ${e}`)
        // if we cant' write this file, let's not show the splash, maybe something weird is going on
        return
      }
      shell.openExternal(help())
    }
  })
}
