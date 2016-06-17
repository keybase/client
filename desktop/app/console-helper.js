import {ipcMain, ipcRenderer} from 'electron'
import util from 'util'
import {forwardLogs} from '../shared/local-debug'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import {logFileName} from '../shared/constants/platform.native.desktop.js'
import setupLocalLogs, {logLocal, warnLocal, errorLocal} from '../shared/util/local-log'

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
// If the file is too big, let's reset the log
if (logFile) {
  // ensure it exists
  mkdirp.sync(path.dirname(logFile))

  fs.access(logFile, fs.W_OK, err => {
    if (err && !fileDoesNotExist(err)) {
      console.log("Can't write to log file.", err)
      fileWritable = null
      return
    }

    fs.stat(logFile, (err, stat) => {
      if (err != null) {
        fileWritable = fs.createWriteStream(logFile)
        return
      }

      if (stat.size > logLimit) {
        fileWritable = fs.createWriteStream(logFile)
        return
      }

      fileWritable = fs.createWriteStream(logFile, {flags: 'a'})
    })
  })
}

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
  if (!forwardLogs) { // eslint-disable-line no-undef
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
  if (!forwardLogs) { // eslint-disable-line no-undef
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
  setupLocalLogs()
  if (!forwardLogs) { // eslint-disable-line no-undef
    return
  }

  window.console.log = (...args) => { try { logLocal(...args); ipcRenderer.send('console.log', args) } catch (_) {} }
  window.console.warn = (...args) => { try { warnLocal(...args); ipcRenderer.send('console.warn', args) } catch (_) {} }
  window.console.error = (...args) => { try { errorLocal(...args); ipcRenderer.send('console.error', args) } catch (_) {} }
}
