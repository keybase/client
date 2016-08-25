import {ipcMain, ipcRenderer} from 'electron'
import util from 'util'
import {forwardLogs} from '../shared/local-debug'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import {logFileName} from '../shared/constants/platform.specific.desktop.js'
import setupLocalLogs from '../shared/util/local-log'

const methods = ['log', 'error', 'info']
const originalConsole = {}
methods.forEach(k => {
  originalConsole[k] = console[k]
})

function fileDoesNotExist (err) {
  if (process.platform === 'win32' && err.errno === -4058) {
    return true
  }

  if (err.errno === -2) {
    return true
  }

  return false
}

const logLimit = 5e6
const logFile = logFileName()
let fileWritable = null

function setupFileWritable () {
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

function tee (...writeFns) {
  return t => writeFns.forEach(w => w(t))
}

const stdErrWriter = process.platform === 'win32' ? () => {} : t => process.stderr.write(t)
const stdOutWriter = process.platform === 'win32' ? () => {} : t => process.stdout.write(t)
const logFileWriter = t => fileWritable && fileWritable.write(t)

// override console logging to also go to stdout
const output = {
  error: tee(stdErrWriter, logFileWriter),
  log: tee(stdOutWriter, logFileWriter),
  warn: tee(stdOutWriter, logFileWriter),
}

export default function pipeLogs () {
  setupLocalLogs()

  if (!forwardLogs) {
    return
  }

  methods.forEach(k => {
    console[k] = (...args) => {
      if (args.length) {
        const out = output[k] || stdOutWriter
        out(`${k}: ${Date()} (${Date.now()}): ${util.format.apply(util, args)}\n`)
      }
    }
  })
}

export function ipcLogs () {
  // Simple ipc logging for debugging remote windows
  if (!forwardLogs) {
    return
  }

  ipcMain.on('console.log', (event, args) => {
    const prologue = `From ${event.sender.getTitle()}: `
    stdOutWriter(prologue)
    logFileWriter(prologue)
    console.log.apply(console, args)
  })

  ipcMain.on('console.warn', (event, args) => {
    const prologue = `From ${event.sender.getTitle()}: `
    stdOutWriter(prologue)
    logFileWriter(prologue)
    console.log.apply(console, args)
  })

  ipcMain.on('console.error', (event, args) => {
    const prologue = `From ${event.sender.getTitle()}: `
    stdOutWriter(prologue)
    logFileWriter(prologue)
    console.log.apply(console, args)
  })
}

export function ipcLogsRenderer () {
  const {logLocal, warnLocal, errorLocal} = setupLocalLogs()

  if (!forwardLogs) {
    return
  }

  window.console.log = (...args) => { try { logLocal(...args); ipcRenderer.send('console.log', args) } catch (_) {} }
  window.console.warn = (...args) => { try { warnLocal(...args); ipcRenderer.send('console.warn', args) } catch (_) {} }
  window.console.error = (...args) => { try { errorLocal(...args); ipcRenderer.send('console.error', args) } catch (_) {} }
}
