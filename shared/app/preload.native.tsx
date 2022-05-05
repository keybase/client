// RN version of preload
// most of KB is for electron
const invalidPreload = () => {
  throw new Error('invalid preload call on RN')
}

global.KB = {
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
  path: {
    basename: invalidPreload,
    dirname: invalidPreload,
    extname: invalidPreload,
    join: invalidPreload,
    resolve: invalidPreload,
    sep: '/',
  },
}
