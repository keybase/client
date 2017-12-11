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

export default openURL
