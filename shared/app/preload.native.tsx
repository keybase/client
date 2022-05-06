// RN version of preload
// most of KB is for electron
const invalidPreload = () => {
  throw new Error('invalid preload call on RN')
}

global.KB = {
  kb: {
    darwinCopyToChatTempUploadFile: () => invalidPreload(),
    setEngine: () => {},
  },
}
