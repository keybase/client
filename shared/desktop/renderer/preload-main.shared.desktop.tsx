import * as Electron from 'electron'
import child_process from 'child_process'
import fs from 'fs'
import os from 'os'
import * as path from 'path'
import punycode from 'punycode'
import buffer from 'buffer'
import framedMsgpackRpc from 'framed-msgpack-rpc'
import purepack from 'purepack'

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global

const getWindow = (key: string) => {
  let all: any
  if (isRenderer) {
    all = Electron.remote.BrowserWindow.getAllWindows()
  } else {
    all = Electron.BrowserWindow.getAllWindows()
  }
  return all.find(w => w.webContents.getURL().indexOf(key) !== -1)
}
const getMainWindow = () => getWindow('/main.')

const renderToMain = (payload: any) => {
  if (isRenderer) {
    Electron.ipcRenderer.send('KBkeybase', payload)
  } else {
    throw new Error('cant send from main renderToMain ')
  }
}
const anyToMainDispatchAction = (action: any) => {
  const mw = getMainWindow()
  if (mw) {
    const {webContents} = mw
    if (webContents) {
      webContents.send('KBdispatchAction', action)
    } else {
      throw new Error('no web contents: anyToMainDispatchAction')
    }
  } else {
    throw new Error('no web browser: anyToMainDispatchAction')
  }
}
const rendererToMainMenu = (payload: any) => {
  if (isRenderer) {
    Electron.ipcRenderer.send('KBmenu', payload)
  } else {
    throw new Error('cant send from main renderToMain ')
  }
}
const handleRendererToMainMenu = (cb: (payload: any) => void) => {
  Electron.ipcMain.on('KBmenu', (_event: any, payload: any) => {
    cb(payload)
  })
}

const handleRenderToMain = (cb: (payload: any) => void) => {
  Electron.ipcMain.on('KBkeybase', (_event: any, payload: any) => {
    cb(payload)
  })
}
const handleAnyToMainDispatchAction = (cb: (action: any) => void) => {
  Electron.ipcRenderer.on('KBdispatchAction', (_event: any, payload: any) => {
    cb(payload)
  })
}

target.KB = {
  __child_process: child_process,
  __dirname: __dirname,
  __electron: Electron,
  __fs: fs,
  __os: os,
  __path: path,
  __process: process,
  anyToMainDispatchAction,
  buffer,
  framedMsgpackRpc,
  handleAnyToMainDispatchAction,
  handleRenderToMain,
  handleRendererToMainMenu,
  punycode, // used by a dep
  purepack,
  renderToMain,
  rendererToMainMenu,
}

if (isRenderer) {
  // target.KB = {
  // ...target.KB,
  // }

  // have to do this else electron blows away process
  setTimeout(() => {
    window.process = {
      env: process.env,
      platform: process.platform,
    }
  }, 0)
}
