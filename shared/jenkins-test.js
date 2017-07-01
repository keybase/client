/* eslint-disable flowtype/require-valid-file-annotation */
var childProcess = require('child_process')

var testType = process.argv[2]
var commitHash = process.argv[3]
var changeTarget = 'origin/' + process.argv[4]
var changeBase
var againstMaster

var defaultExecSyncOptions = {encoding: 'utf8'}

if (!process.argv[4]) {
  againstMaster = true
} else {
  againstMaster = false
  changeBase = execAndLog('git merge-base "' + changeTarget + '" "' + commitHash + '"').replace('\n', '')
}

console.log('shared/jenkins-test.sh recieved type: ' + testType)
console.log(' commitHash: ' + commitHash)
console.log(' changeTarget: ' + changeTarget)
console.log(' changeBase: ' + changeBase)

function execAndLog(cmd, options) {
  var temp
  try {
    console.log('Running:', cmd, '\n\n')
    temp = childProcess.execSync(cmd, Object.assign({}, defaultExecSyncOptions, options))
  } catch (err) {
    console.log('Error running: ' + cmd + err.output, err)
    throw err
  }
  console.log('output:', temp)
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
    'git diff --name-only "' +
    changeBase +
    '"..."' +
    commitHash +
    "\" | grep '^shared/' | grep -v '^shared/jenkins_test\\.sh' | grep -v '^shared/jenkins-test\\.js' " +
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

  console.log('yarn install')
  execAndLog('yarn install --pure-lockfile --prefer-offline --no-emoji --no-progress')
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
    execAndLog('node ../visdiff/dist/index.js ' + changeBase + '...' + commitHash)
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
