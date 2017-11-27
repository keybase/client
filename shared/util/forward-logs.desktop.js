// @flow
import type {LogLineWithLevel} from '../logger/types'

const fileDoesNotExist = __STORYBOOK__
  ? _ => true
  : err => {
      const {isWindows} = require('../constants/platform.desktop')
      if (isWindows && err.errno === -4058) {
        return true
      }
      if (err.errno === -2) {
        return true
      }

      return false
    }

const setupFileWritable = __STORYBOOK__
  ? () => {}
  : () => {
      const {logFileName} = require('../constants/platform.desktop')
      const fs = require('fs')
      const mkdirp = require('mkdirp')
      const path = require('path')

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

// $FlowIssue
const localLog: Log = console._log || console.log.bind(console)
// $FlowIssue
const localWarn: Log = console._warn || console.warn.bind(console)
// $FlowIssue
const localError: Log = console._error || console.error.bind(console)

function tee(...writeFns) {
  return t => writeFns.forEach(w => w(t))
}

const setupTarget = __STORYBOOK__
  ? () => {}
  : () => {
      const fs = require('fs')
      const {forwardLogs} = require('../local-debug')
      if (!forwardLogs) {
        return
      }
      const {ipcMain} = require('electron')
      const util = require('util')
      const {isWindows} = require('../constants/platform.desktop')

      const logFd = setupFileWritable()
      console.log('Using logFd = ', logFd)
      const fileWritable = logFd ? fs.createWriteStream('', {fd: logFd}) : null

      const stdOutWriter = t => {
        !isWindows && process.stdout.write(t)
      }
      const stdErrWriter = t => {
        !isWindows && process.stderr.write(t)
      }
      const logFileWriter = t => {
        fileWritable && fileWritable.write(t)
      }

      const output = {
        error: tee(stdErrWriter, logFileWriter),
        log: tee(stdOutWriter, logFileWriter),
        warn: tee(stdOutWriter, logFileWriter),
      }

      const keys = ['log', 'warn', 'error']
      keys.forEach(key => {
        const override = (...args) => {
          if (args.length) {
            output[key](`${key}: ${Date()} (${Date.now()}): ${util.format('%s', ...args)}\n`)
          }
        }

        // $FlowIssue these can no longer be written to
        console[key] = override
        ipcMain.on(`console.${key}`, (event, ...args) => {
          const prologue = `From ${event.sender.getTitle()}: `
          output[key](prologue)
          override(...args)
        })
      })
      ipcMain.on('console.flushLogFile', (event, ...args) => {
        console.log('Flushing log file', logFd)
        // $FlowIssue flow doesn't know about this function for some reason
        logFd && fs.fdatasyncSync(logFd)
      })
    }

const writeLogLinesToFile: (lines: Array<LogLineWithLevel>) => Promise<void> = __STORYBOOK__
  ? (lines: Array<LogLineWithLevel>) => Promise.resolve()
  : (lines: Array<LogLineWithLevel>) =>
      new Promise((resolve, reject) => {
        if (lines.length === 0) {
          resolve()
          return
        }
        const fs = require('fs')
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

const flushLogFile = __STORYBOOK__
  ? () => {}
  : () => {
      const {ipcRenderer} = require('electron')
      const {dumpLoggers} = require('./periodic-logger')
      dumpLoggers()
      ipcRenderer.send('console.flushLogFile')
    }

export {setupTarget, localLog, localWarn, localError, flushLogFile, writeLogLinesToFile}
