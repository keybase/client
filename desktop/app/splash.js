'use strict'

// Checks to see if we've launched before (we touch started.txt). If not, write the file and open a browser

const helpURL = 'https://keybase.io/docs/cli_kbstage'
const filePath = 'started.txt'
import fs from 'fs'
import {shell} from 'electron'

export default () => {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      fs.writeFileSync(filePath, 'hello world')
      shell.openExternal(helpURL)
    }
  })
}
