import {ipcMain, ipcRenderer} from 'electron'
import util from 'util'
import {forwardLogs} from '../shared/local-debug'
import fs from 'fs'
import {logFileName} from '../shared/constants/platform.native.desktop.js'

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
  fs.access(logFile, fs.W_OK, err => {
    if (err && !fileDoesNotExist(err)) {
      console.log(`Can't write to log file.`, err)
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
const logFileWriter = t => fileWritable && fileWritable.write(t + '\n')

// override console logging to also go to stdout
const output = {
  error: tee(stdErrWriter, logFileWriter),
  log: tee(stdOutWriter, logFileWriter),
  warn: tee(stdOutWriter, logFileWriter)
}

export default function pipeLogs () {
  if (!forwardLogs) { // eslint-disable-line no-undef
    return
  }

  methods.forEach(k => {
    console[k] = (...args) => {
      originalConsole[k].apply(console, args)
      if (args.length) {
        const out = output[k] || stdOutWriter
        out(`${k}: ${Date()} (${Date.now()}): ${util.format.apply(util, args)}`)
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
    console.log('From remote console.log')
    console.log.apply(console, args)
  })

  ipcMain.on('console.warn', (event, args) => {
    console.log('From remote console.warn')
    console.log.apply(console, args)
  })

  ipcMain.on('console.error', (event, args) => {
    console.log('From remote console.error')
    console.log.apply(console, args)
  })
}

export function ipcLogsRenderer () {
  if (!forwardLogs) { // eslint-disable-line no-undef
    return
  }
  window.console.log = (...args) => { try { ipcRenderer.send('console.log', args) } catch (_) {} }
  window.console.warn = (...args) => { try { ipcRenderer.send('console.warn', args) } catch (_) {} }
  window.console.error = (...args) => { try { ipcRenderer.send('console.error', args) } catch (_) {} }
}
