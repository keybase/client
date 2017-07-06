// @flow
import os from 'os'

const webpackLog = null // '~/webpack-log.txt'
const webpackCmd = 'webpack --config ./desktop/webpack.config.babel.js'
const spaceArg = os.platform() === 'win32' ? ' --max_old_space_size=4096' : ''

const commands = {
  'build-dev': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    nodeEnv: 'development',
    shell: `${webpackCmd} --progress --profile --colors ${webpackLog ? `--json > ${webpackLog}` : ''}`,
  },
  'build-prod': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true'},
    help: 'Make a production build of the js code',
    nodeEnv: 'production',
    shell: `${webpackCmd} --progress`,
  },
  'hot-server': {
    env: {BABEL_ENV: 'yarn', HOT: 'true'},
    help: 'Start the webpack hot reloading code server (needed by yarn run start-hot)',
    nodeEnv: 'development',
    shell: `BEFORE_HOT=true yarn run _helper build-dev && BEFORE_HOT=false ${process.env['NO_DASHBOARD']
      ? ''
      : 'webpack-dashboard --'} webpack-dev-server --config=./desktop/webpack.config.babel.js`,
  },
  package: {
    env: {BABEL_ENV: 'yarn', NO_SOURCE_MAPS: 'true'},
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `babel-node ${spaceArg} desktop/package.js`,
  },
}

export default commands
