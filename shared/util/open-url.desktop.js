// @flow
// requires required to make storybook work

const openURL = __STORYBOOK__
  ? (url: ?string) => {}
  : (url: ?string) => {
      const shell = require('electron').shell

      if (!url) {
        console.warn('openURL received empty url')
        return
      }
      shell.openExternal(url)
    }

const openURLWithHelper = __STORYBOOK__
  ? (type: string, params: ?string) => {}
  : (type: string, params: ?string) => {
      const ipcRenderer = require('electron').ipcRenderer
      ipcRenderer.send('openURL', type, params)
    }

export default openURL
export {openURLWithHelper}
