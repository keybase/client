// Builds all three desktop targets (renderer + node + preload) via the Vite JS
// API (desktop/vite-build.mts). Node runs the .mts script directly (type-strip).
const viteBuildCmd = 'node desktop/vite-build.mts'

const commands = {
  'build:dev': {
    env: {NO_SERVER: 'true'},
    help: 'Make a development build of the js code',
    shell: `${viteBuildCmd} --mode development`,
  },
  'build:prod': {
    env: {NO_SERVER: 'true'},
    help: 'Make a production build of the js code',
    shell: `${viteBuildCmd} --mode production`,
  },
  'build:profile': {
    env: {NO_SERVER: 'true', PROFILE: 'true'},
    help: 'Make a profile build of the js code',
    shell: `${viteBuildCmd} --mode production`,
  },
  package: {
    help: 'Package up the production js code',
    nodeEnv: 'production',
    shell: `node desktop/package.desktop.mts`,
  },
} as const

export default commands
