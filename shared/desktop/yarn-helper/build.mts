import os from 'os'

// Rspack CLI. Its config loader natively understands the .mts config, so no
// interpret shim is needed. --progress/--profile are webpack-cli-only flags and
// have no Rspack equivalent (Rspack shows progress on its own); stats go via --json.
const rspackCmd =
  'node --trace-deprecation node_modules/@rspack/cli/bin/rspack.js build --config ./desktop/webpack.config.mts'
const spaceArg = os.platform() === 'win32' ? ' --max_old_space_size=4096' : ''
// set to true if you want to analyze the rspack output
const outputStats = false as boolean

const commands = {
  'build:dev': {
    env: {NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    shell: `${rspackCmd} --mode development`,
  },
  'build:prod': {
    env: {
      NO_SERVER: 'true',
      STATS: outputStats ? 'true' : 'false',
    },
    help: 'Make a production build of the js code',
    shell: `${rspackCmd} --mode production ${outputStats ? '--json rspack-stats.json' : ''}`,
  },
  'build:profile': {
    env: {NO_SERVER: 'true', PROFILE: 'true'},
    help: 'Make a profile build of the js code',
    shell: `${rspackCmd} --mode production`,
  },
  package: {
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `node ${spaceArg} desktop/package.desktop.mts`,
  },
} as const

export default commands
