// @flow
import type {LogLineWithLevelISOTimestamp} from '../logger/types'
import {isWindows, logFileName} from '../constants/platform.desktop'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'

const fileDoesNotExist = err => {
  if (isWindows && err.errno === -4058) {
    return true
  }
  if (err.errno === -2) {
    return true
  }

  return false
}

const setupFileWritable = () => {
  const logFile = logFileName()
  const logLimit = 5e6

  if (!logFile) {
    console.warn('No log file')
    return null
  }

  // Ensure log directory exists
  mkdirp.sync(path.dirname(logFile))

  // Check if we can write to log file
  try {
    fs.accessSync(logFile, fs.W_OK)
  } catch (e) {
    if (!fileDoesNotExist(e)) {
      console.error('Unable to write to log file:', e)
      return null
    }
  }

  try {
    const stat = fs.statSync(logFile)
    if (stat.size > logLimit) {
      const logFileOld = logFile + '.1'
      console.log('Log file over size limit, moving to', logFileOld)
      if (fs.existsSync(logFileOld)) {
        fs.unlinkSync(logFileOld) // Remove old wrapped file
      }
      fs.renameSync(logFile, logFileOld)
      return fs.openSync(logFile, 'a+')
    }
  } catch (e) {
    if (!fileDoesNotExist(e)) {
      console.error('Error checking log file size:', e)
    }
    return fs.openSync(logFile, 'a+')
  }

  // Append to existing log
  return fs.openSync(logFile, 'a')
}

type Log = (...args: Array<any>) => void

const localLog: Log = console.log.bind(console)
const localWarn: Log = console.warn.bind(console)
const localError: Log = console.error.bind(console)

const writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void> = (
  lines: Array<LogLineWithLevelISOTimestamp>
) =>
  new Promise((resolve, reject) => {
    if (lines.length === 0) {
      resolve()
      return
    }
    const encoding = 'utf8'
    const logFd = setupFileWritable()
    console.log('Using logFd = ', logFd)
    const writer = logFd ? fs.createWriteStream('', {fd: logFd}) : null
    if (!writer) {
      console.warn('Error writing log lines to file')
      reject(new Error('Error writing log lines to file'))
      return
    }
    let i = 0
    // Adapted from the nodejs sample: https://nodejs.org/api/stream.html#stream_class_stream_writable
    write()
    function write() {
      let ok = true
      while (i < lines.length && ok) {
        // last time!
        if (i === lines.length - 1) {
          writer.write(JSON.stringify(lines[i]) + '\n', encoding, resolve)
        } else {
          // see if we should continue, or wait
          // don't pass the callback, because we're not done yet.
          ok = writer.write(JSON.stringify(lines[i]) + '\n', encoding)
        }
        i++
      }
      if (i < lines.length) {
        // had to stop early!
        // write some more once it drains
        writer.once('drain', write)
      }
    }
  })

export {localLog, localWarn, localError, writeLogLinesToFile}
