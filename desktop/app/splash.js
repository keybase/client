'use strict'

// Checks to see if we've launched before (we touch started.txt). If not, write the file and open a browser
import {socketRoot} from '../../react-native/react/constants/platform.native.desktop'
import path from 'path'

const helpURL = 'https://keybase.io/docs/cli_kbstage'
const filePath = path.join(socketRoot, 'started.txt')
import fs from 'fs'
import {shell} from 'electron'

export default () => {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      try {
        fs.writeFileSync(filePath, 'hello world')
      }
      catch (e) {
        console.error(`Couldn't mark splash screen shown: ${e}`)
        // if we cant' write this file, let's not show the splash, maybe something weird is going on
        return
      }
      shell.openExternal(helpURL)
    }
  })
}
