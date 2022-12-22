import os from 'os'

const webpackCmd =
  'node --trace-deprecation node_modules/webpack/bin/webpack.js --config ./desktop/webpack.config.babel.js'
const spaceArg = os.platform() === 'win32' ? ' --max_old_space_size=4096' : ''
// set to true if you want to analyze the webpack output
const outputStats = false

const commands = {
  'build-dev': {
    env: {NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    shell: `${webpackCmd} --mode development --progress --profile`,
  },
  'build-prod': {
    env: {
      NO_SERVER: 'true',
      STATS: outputStats ? 'true' : 'false',
    },
    help: 'Make a production build of the js code',
    shell: `${webpackCmd} --mode production --progress ${
      outputStats ? '--profile --json > webpack-stats.json' : ''
    }`,
  },
  'build-profile': {
    env: {NO_SERVER: 'true', PROFILE: 'true'},
    help: 'Make a profile build of the js code',
    shell: `${webpackCmd} --mode production --progress --profile`,
  },
  'hot-server': {
    code: hotServer,
    help: 'Start the webpack hot reloading code server (needed by yarn run start-hot)',
  },
  package: {
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `yarn _node ${spaceArg} desktop/package.desktop.tsx`,
  },
}

function hotServer(info: any, exec: Function) {
  exec('yarn run _helper build-dev', {...info.env, BEFORE_HOT: 'true', HOT: 'true'})
  exec(`webpack-dev-server --mode development --config=./desktop/webpack.config.babel.js`, {
    ...info.env,
    HOT: 'true',
  })
}

export default commands
