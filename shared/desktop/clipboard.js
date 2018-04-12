// @flow

let _clipboard: any

if (__STORYBOOK__) {
  var mocker = {
    get: function(target, name) {
      return () => console.log('mock call', name)
    },
  }
  _clipboard = new Proxy({}, mocker)
} else {
  // must due a require for storybook to work
  const electron = require('electron')
  _clipboard = electron.clipboard
}

const clipboard: any = _clipboard
export default clipboard
