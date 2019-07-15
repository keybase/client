import * as FileSystem from 'expo-file-system'
import {LogLineWithLevelISOTimestamp} from '../logger/types'
import {writeStream, exists} from './file'
import {serialPromises} from './promise'
import {logFileName, logFileDir} from '../constants/platform.native'

const localLog = __DEV__ ? window.console.log.bind(window.console) : () => {}
const localWarn = window.console.warn.bind(window.console)
const localError = window.console.error.bind(window.console)

const writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void> = (
  lines: Array<LogLineWithLevelISOTimestamp>
) =>
  new Promise((resolve, reject) => {
    if (lines.length === 0) {
      resolve()
      return
    }
    const dir = `file://${logFileDir}`
    const logPath = `file://${logFileName}`

    FileSystem.getInfoAsync(dir)
      .then(({isDirectory}) =>
        isDirectory ? Promise.resolve() : FileSystem.makeDirectoryAsync(dir, {intermediates: true})
      )
      .then(() => FileSystem.writeAsStringAsync(logPath, lines.map(log => JSON.stringify(log)).join('\n')))
      .then(() => {
        console.log('Log write done')
        resolve()
      })
      .catch(err => {
        console.warn(`Couldn't log send! ${err}`)
        reject(err)
      })
  })

export {localLog, localWarn, localError, writeLogLinesToFile}
