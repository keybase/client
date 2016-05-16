// Checks to see if we've launched before (we touch started.txt). If not, write the file and open a browser
import {splashRoot} from '../shared/constants/platform.native.desktop'
import path from 'path'
import fs from 'fs'

const filePath = path.join(splashRoot, 'started.txt')

let _firstTimeCachedValue = null

let isFirstTime: () => Promise<boolean> = () => new Promise((resolve, reject) => {
  if (_firstTimeCachedValue !== null) {
    resolve(_firstTimeCachedValue)
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      try {
        fs.writeFileSync(filePath, 'This file gets created on first run of the app')
      } catch (e) {
        console.error(`Couldn't touch startup.txt file: ${e}`)
        // if we cant' write this file, let's not assume this is the first time, maybe something weird is going on
        _firstTimeCachedValue = false
        resolve(false)
        return
      }
      _firstTimeCachedValue = true
      resolve(true)
      return
    }

    _firstTimeCachedValue = false
    resolve(false)
  })
})

export default isFirstTime
