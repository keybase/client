// Storybook version of preload
// most of KB is for electron
import path from 'path'

global.KB = {
  get __dirname() {
    return __dirname
  },
  electron: {
    app: {
      get appPath() {
        return ''
      },
    },
    dialog: {
      showOpenDialog: async () => {},
      showSaveDialog: async () => {},
    },
  },
  path: {
    basename: path.basename,
    extname: path.extname,
    join: path.join,
    resolve: path.resolve,
    sep: '/',
  },
  process: {
    argv: [],
    env: {},
    pid: 0,
    platform: 'darwin',
    type: 'storybook',
  },
  // punycode, // used by a dep
}
