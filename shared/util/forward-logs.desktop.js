// @flow
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from 'util'
import {forwardLogs} from '../local-debug'
import {ipcMain, ipcRenderer} from 'electron'
import {logFileName, isWindows} from '../constants/platform.desktop'

let fileWritable = null

function setupFileWritable () {
  const logFile = logFileName()
  const logLimit = 5e6

  if (!logFile) {
    console.warn('No log file')
    return
  }
  // Ensure log directory exists
  mkdirp.sync(path.dirname(logFile))

  // Check if we can write to log file
  try {
    fs.accessSync(logFile, fs.W_OK)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Unable to write to log file:', err)
      return
    }
  }

  try {
    const stat = fs.statSync(logFile)
    if (stat.size > logLimit) {
      const logFileOld = logFile + '.1'
      console.log('Log file over size limit, moving to', logFileOld)
      if (fs.existsSync(logFileOld)) {
        fs.unlinkSync(logFileOld) // Remove old file wrapped file
      }
      fs.renameSync(logFile, logFileOld)
      fileWritable = fs.createWriteStream(logFile)
      return
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error checking log file size:', err)
    }
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

function tee (...writeFns) {
  return t => writeFns.forEach(w => w(t))
}

let didSetupTarget = false

function setupTarget () {
  if (!forwardLogs) {
    return
  }
  if (didSetupTarget) return
  didSetupTarget = true

  const stdOutWriter = t => { !isWindows && process.stdout.write(t) }
  const stdErrWriter = t => { !isWindows && process.stderr.write(t) }
  const logFileWriter = t => { fileWritable && fileWritable.write(t) }

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
}

function setupSource () {
  if (!forwardLogs) {
    return
  }

  ['log', 'warn', 'error'].forEach(key => {
    // $FlowIssue these can no longer be written to
    console[key] = (...args) => {
      try {
        key === 'log' && localLog(...args)
        key === 'warn' && localWarn(...args)
        key === 'error' && localError(...args)
        const toSend = util.format('%j', args)
        ipcRenderer.send('console.' + key, toSend)
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
