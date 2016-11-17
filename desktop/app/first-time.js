// @flow
// Checks to see if we've launched before (we touch started.txt). If not, write the file and open a browser
import {splashRoot} from '../shared/constants/platform.desktop'
import path from 'path'
import fs from 'fs'

const filePath = path.join(splashRoot, 'started.txt')

const isFirstTime: Promise<boolean> = new Promise((resolve, reject) => {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      try {
        fs.writeFileSync(filePath, 'This file gets created on first run of the app')
      } catch (err) {
        console.error('Couldn\'t touch startup.txt file:', err)
        // if we cant' write this file, let's not assume this is the first time, maybe something weird is going on
        resolve(false)
        return
      }
      resolve(true)
      return
    }

    resolve(false)
  })
})

export default isFirstTime
