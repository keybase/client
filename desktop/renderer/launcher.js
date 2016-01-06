import {remote} from 'electron'
import React from 'react'
import Menubar from '../../react-native/react/native/remote-menubar'
import reactDOM from 'react-dom'
import {showMainWindow} from '../../react-native/react/local-debug.desktop'

import consoleHelper from '../app/console-helper'

consoleHelper()

if (module.hot) {
  module.hot.accept()
}

// The menubar has a variable height, and we want to account for that until a certain height
// After that height, we'll just use the scroll bar
const currentWindow = remote.getCurrentWindow()
const width = 320
let cachedHeight = 300
const resizeWindowForComponent = () => {
  setImmediate(() => {
    const r = document.getElementById('root')
    const height = r.scrollHeight
    if (height !== cachedHeight) {
      currentWindow.setSize(width, height)
      cachedHeight = height
    }
  })
}

reactDOM.render(React.createElement(Menubar, {debug: showMainWindow, onSizeChange: resizeWindowForComponent}), document.getElementById('root'))
