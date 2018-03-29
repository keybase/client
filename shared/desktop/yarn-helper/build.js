// @flow
import os from 'os'

const webpackLog = null // '~/webpack-log.txt'
const webpackCmd = 'webpack --config ./desktop/webpack.config.babel.js'
const spaceArg = os.platform() === 'win32' ? ' --max_old_space_size=4096' : ''
const outputStats = false

const commands = {
  'build-dev': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    shell: `${webpackCmd} --mode development --progress --profile --colors ${
      webpackLog ? `--json > ${webpackLog}` : ''
    }`,
  },
  'build-prod': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a production build of the js code',
    shell: `${webpackCmd} --mode production --progress ${outputStats ? '--json > webpack-stats.json' : ''}`,
  },
  'hot-server': {
    code: hotServer,
    env: {BABEL_ENV: 'yarn'},
    help: 'Start the webpack hot reloading code server (needed by yarn run start-hot)',
  },
  package: {
    env: {BABEL_ENV: 'yarn', NO_SOURCE_MAPS: 'true'},
    help: 'Package up the production js code',
    shell: `babel-node ${spaceArg} desktop/package.js`,
  },
}

function hotServer(info: any, exec: Function) {
  exec('yarn run _helper build-dev', {...info.env, BEFORE_HOT: 'true', HOT: 'true'})
  const dash = process.env['NO_DASHBOARD'] ? '' : 'webpack-dashboard --'
  exec(`${dash} webpack-dev-server --mode development --config=./desktop/webpack.config.babel.js`, {
    ...info.env,
    HOT: 'true',
  })
}

export default commands
