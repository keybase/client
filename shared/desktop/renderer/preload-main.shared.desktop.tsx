import Electron from 'electron'
import child_process from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import punycode from 'punycode'
import buffer from 'buffer'
import framedMsgpackRpc from 'framed-msgpack-rpc'
import purepack from 'purepack'

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global

target.KB = {
  __child_process: child_process,
  __dirname: __dirname,
  __electron: Electron,
  __fs: fs,
  __os: os,
  __path: path,
  __process: process,
  buffer,
  framedMsgpackRpc,
  purepack,
  punycode, // used by a dep
}

if (isRenderer) {
  // have to do this else electron blows away process
  setTimeout(() => {
    window.process = {
      env: process.env,
      platform: process.platform,
    }
  }, 0)
}
