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
  'build-treeshake': {
    env: {BABEL_ENV: 'yarn', NO_SERVER: 'true', TREESHAKE: 'true'},
    help: 'Make a treeshake version of the build',
    nodeEnv: 'development',
    shell: `${webpackCmd} --progress --profile --colors ${
      webpackLog ? `--json > ${webpackLog}` : ''
    } && echo '\n\n\nSearch desktop/dist/_.bundle.js for unused harmoney comments. Note it doesnt understand mobile so use flow and lint to double check everything!'`, // eslint-disable-line no-useless-escape
  },
  'hot-server': {
    code: hotServer,
    env: {BABEL_ENV: 'yarn', HOT: 'true'},
    help: 'Start the webpack hot reloading code server (needed by yarn run start-hot)',
    nodeEnv: 'development',
  },
  package: {
    env: {BABEL_ENV: 'yarn', NO_SOURCE_MAPS: 'true'},
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `babel-node ${spaceArg} desktop/package.js`,
  },
}

function hotServer(info: any, exec: Function) {
  exec('yarn run _helper build-dev', {...info.env, BEFORE_HOT: 'true'})
  exec(
    `${
      process.env['NO_DASHBOARD'] ? '' : 'webpack-dashboard --'
    } webpack-dev-server --config=./desktop/webpack.config.babel.js`,
    {...info.env, BEFORE_HOT: 'false'}
  )
}

export default commands
