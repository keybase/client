import {noop} from 'lodash-es'
import RNFetchBlob from 'rn-fetch-blob'
import {LogLineWithLevelISOTimestamp} from '../logger/types'
import {writeStream, exists} from './file'
import {serialPromises} from './promise'
import {logFileName, logFileDir} from '../constants/platform.native'

const localLog = __DEV__ ? window.console.log.bind(window.console) : noop
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
    const dir = logFileDir
    const logPath = logFileName

    RNFetchBlob.fs
      .isDir(dir)
      .then(isDir => (isDir ? Promise.resolve() : RNFetchBlob.fs.mkdir(dir)))
      .then(() => exists(logPath))
      .then(exists => (exists ? Promise.resolve() : RNFetchBlob.fs.createFile(logPath, '', 'utf8')))
      .then(() => writeStream(logPath, 'utf8', true))
      .then(stream => {
        const writeLogsPromises = lines.map(log => () => stream.write(JSON.stringify(log) + '\n'))
        return serialPromises(writeLogsPromises).then(() => stream.close())
      })
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
