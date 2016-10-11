// @flow
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from 'util'
import {forwardLogs} from '../local-debug'
import {ipcMain, ipcRenderer} from 'electron'
import {logFileName} from '../constants/platform.specific.desktop.js'

let fileWritable = null

function fileDoesNotExist (err) {
  if (process.platform === 'win32' && err.errno === -4058) { return true }
  if (err.errno === -2) { return true }

  return false
}

function setupFileWritable () {
  const logFile = logFileName()
  const logLimit = 5e6

  if (!logFile) {
    console.log('No log file')
    return
  }
  // Ensure log directory exists
  mkdirp.sync(path.dirname(logFile))

  // Check if we can write to log file
  try {
    fs.accessSync(logFile, fs.W_OK)
  } catch (e) {
    if (!fileDoesNotExist(e)) {
      console.error('Unable to write to log file:', e)
      return
    }
  }

  let stat = null
  try {
    stat = fs.statSync(logFile)
  } catch (e) {
    if (!fileDoesNotExist(e)) {
      console.error('Error getting status for log file:', e)
    }
    fileWritable = fs.createWriteStream(logFile)
    return
  }

  // If the file is too big, let's reset the log
  if (stat.size > logLimit) {
    console.log('File too big, resetting')
    fileWritable = fs.createWriteStream(logFile)
    return
  }

  // Append to existing log
  fileWritable = fs.createWriteStream(logFile, {flags: 'a'})
}

setupFileWritable()

type Log = (...args: Array<any>) => void

// $FlowIssue
const localLog: Log = console._log || console.log.bind(console)
// $FlowIssue
const localWarn: Log = console._warn || console.warn.bind(console)
// $FlowIssue
const localError: Log = console._error || console.error.bind(console)

function setupTarget () {
  if (!forwardLogs) {
    return
  }

  const stdOutWriter = t => { (process.platform !== 'win32') && process.stdout.write(t) }
  const logFileWriter = t => { fileWritable && fileWritable.write(t) }

  ['log', 'warn', 'error'].forEach(key => {
    ipcMain.on(`console.${key}`, (event, args) => {
      const toLog = `From ${event.sender.getTitle()}: ${args}`
      stdOutWriter(toLog)
      logFileWriter(toLog)
    })
  })
}

function setupSource () {
  if (!forwardLogs) {
    return
  }

  ['log', 'warn', 'error'].forEach(key => {
    console[key] = (...args) => {
      try {
        const toSend = util.inspect(args)
        ipcRenderer.send('console.' + key, toSend + '\n')
      } catch (_) {}
    }
  })
}

export {
  setupSource,
  setupTarget,
  localLog,
  localWarn,
  localError,
}
