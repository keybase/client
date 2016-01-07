import {ipcMain, ipcRenderer} from 'electron'
import util from 'util'

export default function pipeLogs () {
  if (!__DEV__) { // eslint-disable-line no-undef
    return
  }

  // override console logging to also go to stdout
  const methods = ['log', 'error', 'info']
  const output = {
    error: process.stderr
  }
  const oldConsole = {}

  methods.forEach(k => {
    if (!oldConsole.hasOwnProperty(k)) {
      oldConsole[k] = console[k]
      console[k] = (...args) => {
        oldConsole[k].apply(console, args)
        if (args.length) {
          const out = output[k] || process.stdout
          out.write(k + ': ' + util.format.apply(util, args))
        }
      }
    }
  })
}

export function ipcLogs () {
  // Simple ipc logging for debugging remote windows

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
  window.console.log = (...args) => ipcRenderer.send('console.log', args)
  window.console.warn = (...args) => ipcRenderer.send('console.warn', args)
  window.console.error = (...args) => ipcRenderer.send('console.error', args)
}
