import reactDOM from 'react-dom'
import React, {Component} from '../../react-native/react/base-react'
import {showMainWindow} from '../../react-native/react/local-debug.desktop'
import {Provider} from 'react-redux'
import RemoteStore from '../../react-native/react/native/remote-store.desktop'
import Menubar from '../../react-native/react/menubar'
import consoleHelper from '../app/console-helper'
import hello from '../../react-native/react/util/hello'

consoleHelper()
hello(process.pid, 'Menubar', process.argv)

if (module.hot) {
  module.hot.accept()
}

const store = new RemoteStore({})

class RemoteMenubar extends Component {
  render () {
    return (
      <Provider store={store}>
        <Menubar debug={!!showMainWindow}/>
      </Provider>
    )
  }
}

reactDOM.render(React.createElement(RemoteMenubar), document.getElementById('root'))
