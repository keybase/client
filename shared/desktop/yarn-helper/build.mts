import os from 'os'

const webpackCmd =
  'node --trace-deprecation node_modules/webpack/bin/webpack.js --disable-interpret --config ./desktop/webpack.config.mts'
const spaceArg = os.platform() === 'win32' ? ' --max_old_space_size=4096' : ''
// set to true if you want to analyze the webpack output
const outputStats = false as boolean

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
  package: {
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `node ${spaceArg} desktop/package.desktop.mts`,
  },
} as const

export default commands
