// @flow
// Helper for cross platform yarn run script commands
import buildCommands from './build'
import electronComands from './electron'
import fontCommands from './font'
import prettierCommands from './prettier'
import {execSync} from 'child_process'
import path from 'path'
import fs from 'fs'

const [, , command, ...rest] = process.argv

const commands = {
  ...buildCommands,
  ...fontCommands,
  ...electronComands,
  ...prettierCommands,
  help: {
    code: () => {
      console.log(
        Object.keys(commands)
          .map(c => commands[c].help && `yarn run ${c}}${commands[c].help || ''}`)
          .filter(Boolean)
          .join('\n')
      )
    },
  },
  postinstall: {
    code: () => {
      // storybook uses react-docgen which really cr*ps itself with flow
      // I couldn't find a good way to override this effectively (yarn resolutions didn't work) so we're just killing it with fire
      makeShims()
      fixLottie()
    },
    help: '',
  },
}

function fixLottie() {
  // hardcode a fix for lotties busted build for now TODO remove this when its updated
  const replacement = `
def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

apply plugin: 'com.android.library'
apply from: 'gradle-maven-push.gradle'

android {
  compileSdkVersion safeExtGet('compileSdkVersion', 26)
  buildToolsVersion safeExtGet('buildToolsVersion', '26.0.3')
  publishNonDefault true

  defaultConfig {
    minSdkVersion safeExtGet('minSdkVersion', 16)
    targetSdkVersion safeExtGet('targetSdkVersion', 26)
  }

  lintOptions {
    disable 'InvalidPackage'
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_1_7
    targetCompatibility JavaVersion.VERSION_1_7
  }
}

dependencies {
  compileOnly "com.facebook.react:react-native:+"
  implementation 'com.airbnb.android:lottie:2.5.5'
  // KB:
  api("com.android.support:appcompat-v7:28.0.0")
}
`
  const root = path.resolve(__dirname, '..', '..', 'node_modules', 'lottie-react-native', 'src', 'android')
  try {
    fs.mkdirSync(root)
  } catch (_) {}

  try {
    fs.writeFileSync(path.join(root, 'build.gradle'), replacement)
  } catch (_) {}
}

function makeShims() {
  const root = path.resolve(__dirname, '..', '..', 'node_modules', 'babel-plugin-react-docgen')

  try {
    fs.mkdirSync(root)
  } catch (_) {}

  try {
    fs.writeFileSync(path.join(root, 'package.json'), `{"main": "index.js"}`)
    fs.writeFileSync(path.join(root, 'index.js'), `module.exports = function(){return {};};`)
  } catch (_) {}
}

function exec(command, env, options) {
  console.log(execSync(command, {encoding: 'utf8', env: env || process.env, stdio: 'inherit', ...options}))
}

const decorateInfo = info => {
  let temp = {
    ...info,
    env: {
      ...process.env,
      ...info.env,
    },
  }

  if (info.nodeEnv) {
    temp.env.NODE_ENV = info.nodeEnv
  }

  if (rest.length && temp.shell) {
    temp.shell = `${temp.shell} ${rest.join(' ')}`
  }

  return temp
}

function main() {
  let info = commands[command]

  if (!info) {
    console.log('Unknown command: ', command)
    process.exit(1)
  }

  info = decorateInfo(info)

  if (info.shell) {
    exec(info.shell, info.env, info.options)
  }

  if (info.code) {
    info.code(info, exec)
  }
}

main()
