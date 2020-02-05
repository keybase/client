// RN version of preload
const {env} = process

// most of KB is for electron
const invalidPreload = () => {
  throw new Error('invalid preload call on RN')
}

global.KB = {
  get __dirname() {
    return invalidPreload()
  },
  electron: {
    app: {
      get appPath() {
        return invalidPreload()
      },
    },
  },
  os: {
    get homedir() {
      return invalidPreload()
    },
  },
  path: {
    basename: invalidPreload,
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
