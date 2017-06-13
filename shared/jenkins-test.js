/* eslint-disable flowtype/require-valid-file-annotation */
var childProcess = require('child_process')

var testType = process.argv[2]
var commitHash = process.argv[3]
var changeTarget = 'origin/' + process.argv[4]
var changeBase
var againstMaster

var defaultExecSyncOptions = {encoding: 'utf8'}

console.log('aaaa', process.argv)

if (!process.argv[4]) {
  againstMaster = true
} else {
  againstMaster = false
  changeBase = childProcess.execSync(
    'git merge-base ' + changeTarget + ' ' + commitHash,
    defaultExecSyncOptions
  )
}

console.log('shared/jenkins-test.sh recieved type: ' + testType)
console.log(' commitHash: ' + commitHash)
console.log(' changeTarget: ' + changeTarget)
console.log(' changeBase: ' + changeBase)

function execAndLog(cmd, options) {
  try {
    var temp = childProcess.execSync(cmd, Object.assign({}, defaultExecSyncOptions, options))
    console.log(temp)
  } catch (err) {
    console.log('Error running: ' + cmd + err.output)
    throw err
  }
  return temp
}

function has_js_files(extra_commands) {
  if (againstMaster) {
    console.log('Missing changeTarget, forcing has_js_files to true')
    return
  }

  console.log('git fetch')
  execAndLog('git fetch')

  console.log('git diff')
  execAndLog('git diff --name-only "' + changeBase + '...' + commitHash + '"')

  var cmd =
    'git diff --name-only ' +
    changeBase +
    '...' +
    commitHash +
    " | grep '^shared/' | grep -v '^shared/jenkins-test\\.sh'" +
    extra_commands
  console.log('filtered diff')
  var diff_files = execAndLog(cmd)

  if (!diff_files) {
    console.log('no files js cares about')
    process.exit(0)
  }

  console.log('continuing due to changes in $diff_files')
}

function js_tests() {
  console.log('js-tests')
  execAndLog('node --version')
  has_js_files('')

  // TEMP
  // console.log('yarn install')
  // execAndLog('yarn install --pure-lockfile --prefer-offline --no-emoji --no-progress')
  console.log('yarn run flow')
  execAndLog('yarn run flow')
  console.log('yarn run lint')
  execAndLog('yarn run lint')
  console.log('yarn test')
  execAndLog('yarn test')
}

var visdiff_extra_commands = "| grep -v '^shared/constants/types/flow-types'"

function visdiff() {
  console.log('visdiff')
  has_js_files(visdiff_extra_commands)
  if (againstMaster) {
    console.log('No $changeTarget, skipping visdiff')
  } else {
    execAndLog('node ../visdiff/dist/index.js "' + changeBase + '...' + commitHash)
  }
}

function visdiff_install() {
  console.log('visdiff-install')
  has_js_files(visdiff_extra_commands)
  if (againstMaster) {
    console.log('No ' + changeTarget + ', skipping visdiff')
  } else {
    execAndLog('yarn install --pure-lockfile', {cwd: '../visdiff'})
  }
}

function main() {
  if (testType === 'visdiff') visdiff()
  else if (testType === 'visdiff-install') {
    visdiff_install()
  } else {
    js_tests()
  }
}

main()
