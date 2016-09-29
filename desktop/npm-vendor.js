#!/usr/bin/env node
// @flow

var os = require('os')
var path = require('path')
var fs = require('fs')
var spawnSync = require('child_process').spawnSync

var VENDOR_DIR = process.env.KEYBASE_JS_VENDOR_DIR
const NPM_CMD = os.platform() === 'win32' ? 'npm.cmd' : 'npm'

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
  options = options || {}
  args = args || []
  console.log((options.cwd || '') + '>', command, args.join(' '))
  var res = spawnSync(command, args, Object.assign({stdio: 'inherit', encoding: 'utf8'}, options))
  if (res.error) {
    throw res.error
  } else if (res.status !== 0) {
    throw new Error('Unexpected exit code: ' + res.status)
  }
  return res
}

function updateVendored () {
  function checkClean (dir) {
    var statusRes = spawn('git', ['status', '--porcelain'], {cwd: dir, stdio: 'pipe'})
    if (statusRes.stdout.length) {
      console.log(`Uncommitted changes detected in ${path.resolve(dir)}. Please commit your work and re-run.`)
      process.exit(1)
    }
  }

  if (!fs.existsSync(VENDOR_DIR)) {
    console.log(`Could not find vendor dir: ${VENDOR_DIR}`)
    process.exit(1)
  }

  checkClean('./')
  checkClean(VENDOR_DIR)

  console.log('\nShrinkwrapping...')

  try {
    spawn(NPM_CMD, ['run', 'wrap'])
  } catch (e) {
    console.log('\nUh oh! Shrinkwrapping failed. Try manually running `npm run wrap` to retry.')
    process.exit(1)
  }
  spawn('git', ['add', './npm-shrinkwrap.json'])

  console.log('\nShrinkpacking...')
  ensureSymlink('./node_shrinkwrap', path.join(VENDOR_DIR, 'node_shrinkwrap'))
  spawn('shrinkpack', ['-c'])

  console.log('\nCommitting deps to js vendor repo...')
  fs.renameSync('./npm-shrinkwrap.json', path.join(VENDOR_DIR, 'npm-shrinkwrap.json'))
  spawn('git', ['add', './node_shrinkwrap', './npm-shrinkwrap.json'], {cwd: VENDOR_DIR})

  function cleanup () {
    // clean up npm-shrinkwrap.json and node_shrinkwrap/ dir to leave the repo
    // in a pristine state.
    console.log('\nCleaning up...')
    spawn('git', ['checkout', 'HEAD', '--', './npm-shrinkwrap.json'])
    fs.unlinkSync('./node_shrinkwrap')
  }

  var vendorStatusRes = spawn('git', ['status', '--porcelain'], {cwd: VENDOR_DIR, stdio: 'pipe'})
  if (!vendorStatusRes.stdout.length) {
    console.log('\nNo vendoring changes needed. Done.')
    cleanup()
    return
  }

  spawn('git', ['commit', '-n', '-m', 'Update desktop deps'], {cwd: VENDOR_DIR})

  console.log('\nCommitting vendor update in client repo...')
  var vendorURL = spawn('git', ['config', '--get', 'remote.origin.url'], {cwd: VENDOR_DIR, stdio: 'pipe'}).stdout.trim()
  // force HTTPS for more efficient cloning
  vendorURL = vendorURL.replace(/^git@github.com:/, 'https://github.com/')
  var vendorCommit = spawn('git', ['rev-parse', 'HEAD'], {cwd: VENDOR_DIR, stdio: 'pipe'}).stdout.trim()
  var packageInfo = JSON.parse(fs.readFileSync('./package.json'))
  packageInfo.keybaseVendoredDependencies = `${vendorURL}#${vendorCommit}`
  fs.writeFileSync('./package.json', JSON.stringify(packageInfo, 2, 2))
  spawn('git', ['add', './package.json'])
  spawn('git', ['commit', '-n', '-m', 'Update vendored deps'])

  cleanup()

  console.log('Updated keybaseVendoredDependencies:', packageInfo.keybaseVendoredDependencies)
  console.log('\nDone!')
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
  spawn(NPM_CMD, ['install', '--loglevel=http', '--no-optional'], {
    env: Object.assign({}, process.env, {
      ELECTRON_CACHE: path.resolve(path.join(VENDOR_DIR, 'electron')),
      ELECTRON_ONLY_CACHE: 1,
    }),
  })
}

if (!VENDOR_DIR) {
  console.log('Error: KEYBASE_JS_VENDOR_DIR unset. Please specify a location for the vendoring repo.')
  process.exit(1)
}

var npmVersionRes = spawn(NPM_CMD, ['-v'], {stdio: 'pipe'})
var npmVersion = npmVersionRes.stdout.split('.').map(n => parseInt(n, 10))
var npmTooOld = npmVersion[0] === 3 && (npmVersion[1] < 10 || npmVersion[1] === 10 && npmVersion[2] < 4)
var npmTooNew = npmVersion[0] === 3 && (npmVersion[1] > 8 || npmVersion[1] === 8 && npmVersion[2] > 7)
if (npmTooOld && npmTooNew) {
  console.log(`Error: Your version of npm (${npmVersion.join('.')}) contains a regression which makes it incompatible with shrinkpack. Please upgrade npm to 3.10.4 or later.`)
  process.exit(1)
}

if (process.argv[process.argv.length - 1] === 'update') {
  updateVendored()
} else {
  installVendored()
}
