// RN version of preload
const {env} = process

// most of KB is for electron
const invalidPreload = () => {
  throw new Error('invalid preload call on RN')
}

const debugConsoleLog: () => void = console.log.bind(console) as any

global.KB = {
  get __dirname() {
    return invalidPreload()
  },
  debugConsoleLog,
  electron: {
    app: {
      get appPath() {
        return invalidPreload()
      },
    },
    dialog: {
      showOpenDialog: invalidPreload,
      showSaveDialog: invalidPreload,
    },
  },
  kb: {
    darwinCopyToChatTempUploadFile: () => invalidPreload(),
    darwinCopyToKBFSTempUploadFile: () => invalidPreload(),
    setEngine: () => {},
  },
  os: {
    get homedir() {
      return invalidPreload()
    },
  },
  path: {
    basename: invalidPreload,
    dirname: invalidPreload,
    extname: invalidPreload,
    join: invalidPreload,
    resolve: invalidPreload,
    sep: '/',
  },
  process: {
    get argv() {
      return invalidPreload()
    },
    env: {},
    get pid() {
      return invalidPreload()
    },
    get platform() {
      return invalidPreload()
    },
    get type() {
      return invalidPreload()
    },
  },
  // punycode, // used by a dep
}
