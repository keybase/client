// @flow

import {shell} from 'electron'
import {helpUrl} from '../constants/urls'

import {dataRoot, cacheRoot} from '../constants/platform.desktop'
import path from 'path'
import fs from 'fs'

const touchPath = path.join(dataRoot, 'started.txt')
const previousTouchPath = path.join(cacheRoot, 'started.txt')
const filePaths = [touchPath, previousTouchPath]

const isFirstRun: Promise<boolean> = new Promise((resolve, reject) => {
  for (let filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      resolve(false)
      return
    }
  }

  try {
    fs.writeFileSync(
      touchPath,
      'This file gets created on first run of the app'
    )
  } catch (err) {
    console.error(`Couldn't touch file:`, err)
    // If we cant' write this file, let's not assume this is the first run
    resolve(false)
    return
  }
  resolve(true)
})

export default () => {
  isFirstRun.then(firstRun => firstRun && shell.openExternal(helpUrl))
}
