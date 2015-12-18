import {remote} from 'electron'
import React from 'react'
import Menubar from '../../react-native/react/native/remote-menubar'
import reactDOM from 'react-dom'
import {showMainWindow} from '../../react-native/react/local-debug.desktop'

if (module.hot) {
  module.hot.accept()
}

// The menubar has a variable height, and we want to account for that until a certain height
// After that height, we'll just use the scroll bar
const currentWindow = remote.getCurrentWindow()
let cachedSizes = {width: 0, height: 0}
const resizeWindowForComponent = () => {
  setImmediate(() => {
    const r = document.getElementById('root')
    const [width, height] = [r.scrollWidth, r.scrollHeight]
    if (width !== cachedSizes.width || height !== cachedSizes.height) {
      currentWindow.setContentSize(width, height)
      cachedSizes = {width, height}
    }
  })
}

reactDOM.render(React.createElement(Menubar, {debug: showMainWindow, onSizeChange: resizeWindowForComponent}), document.getElementById('root'))
