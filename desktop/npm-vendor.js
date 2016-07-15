#!/usr/bin/env node

var os = require('os')
var path = require('path')
var fs = require('fs')
var spawnSync = require('child_process').spawnSync

var VENDOR_DIR = process.env.KEYBASE_JS_VENDOR_DIR || './js-vendor-desktop'

function ensureSymlink (target, dest) {
  if (fs.existsSync(target)) {
    console.log('Removing existing', target)
    fs.unlinkSync(target)
  }

  var absDest = path.resolve(dest)
  console.log('Linking', target, '->', absDest)
  fs.symlinkSync(absDest, target)
}

function spawn (command, args, options) {
  console.log('>', command, args.join(' '))
  var res = spawnSync(command, args, Object.assign({stdio: 'inherit', encoding: 'utf8'}, options))
  if (res.error) {
    throw res.error
  } else if (res.status !== 0) {
    throw new Error('Unexpected exit code: ' + res.status)
  }
}

function installVendored () {
  var packageInfo = JSON.parse(fs.readFileSync('./package.json'))
  var parts = packageInfo.keybaseVendoredDependencies.split('#')
  var url = parts[0]
  var commit = parts[1]

  if (!fs.existsSync(VENDOR_DIR)) {
    spawn('git', ['clone', url, VENDOR_DIR])
  }
  spawn('git', ['fetch', 'origin'], {cwd: VENDOR_DIR})
  spawn('git', ['checkout', '-f', commit], {cwd: VENDOR_DIR})
  console.log(`js-vendor-desktop: ${url} @ ${commit}`)

  ensureSymlink('./npm-shrinkwrap.json', path.join(VENDOR_DIR, 'npm-shrinkwrap.json'))
  ensureSymlink('./node_shrinkwrap', path.join(VENDOR_DIR, 'node_shrinkwrap'))
  spawn(os.platform() === 'win32' ? 'npm.cmd' : 'npm', ['install', '--loglevel=http', '--no-optional'], {
    env: Object.assign({}, process.env, {
      ELECTRON_CACHE: path.resolve(path.join(VENDOR_DIR, 'electron')),
      ELECTRON_ONLY_CACHE: 1,
    }),
  })
}

installVendored()
