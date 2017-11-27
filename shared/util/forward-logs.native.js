// @flow
import noop from 'lodash/noop'
import RNFetchBlob from 'react-native-fetch-blob'
import logger from './logger'
import type {LogLineWithLevel} from '../logger/types'
import {forwardLogs} from '../local-debug'
import {writeStream, exists} from './file'
import {serialPromises} from './promise'
import {logFileName, logFileDir} from '../constants/platform.native'

let forwarded = false

const localLog = __DEV__ ? window.console.log.bind(window.console) : noop
const localWarn = window.console.warn.bind(window.console)
const localError = window.console.error.bind(window.console)

function setupSource() {
  if (!forwardLogs) {
    return
  }

  if (forwarded) {
    return
  }
  forwarded = true

  const makeOverride = method => {
    return function(a1, a2, a3, a4, a5) {
      if (arguments.length === 1) {
        localLog(a1)
        logger[method](a1)
      } else if (arguments.length === 2) {
        localLog(a1, a2)
        logger[method](a1, a2)
      } else if (arguments.length === 3) {
        localLog(a1, a2, a3)
        logger[method](a1, a2, a3)
      } else if (arguments.length === 4) {
        localLog(a1, a2, a3, a4)
        logger[method](a1, a2, a3, a4)
      } else if (arguments.length === 5) {
        localLog(a1, a2, a3, a4, a5)
        logger[method](a1, a2, a3, a4, a5)
      }
    }
  }

  window.console.log = makeOverride('info')
  window.console.warn = makeOverride('warn')
  window.console.error = makeOverride('error')
}

function flushLogFile() {}

const writeLogLinesToFile: (lines: Array<LogLineWithLevel>) => Promise<void> = (
  lines: Array<LogLineWithLevel>
) =>
  new Promise((resolve, reject) => {
    if (lines.length === 0) {
      resolve()
      return
    }
    const dir = logFileDir()
    const logPath = logFileName()

    RNFetchBlob.fs
      .isDir(dir)
      .then(isDir => (isDir ? Promise.resolve() : RNFetchBlob.fs.mkdir(dir)))
      .then(() => exists(logPath))
      .then(exists => (exists ? Promise.resolve() : RNFetchBlob.fs.createFile(logPath, '', 'utf8')))
      .then(() => writeStream(logPath, 'utf8', true))
      .then(stream => {
        const writeLogsPromises = lines.map((log, idx) => {
          return () => {
            return stream.write(JSON.stringify(log) + '\n')
          }
        })
        return serialPromises(writeLogsPromises).then(() => stream.close())
      })
      .then(success => {
        console.log('Log write done')
        resolve()
      })
      .catch(err => {
        console.warn(`Couldn't log send! ${err}`)
        reject(err)
      })
  })

export {setupSource, localLog, localWarn, localError, flushLogFile, writeLogLinesToFile}
