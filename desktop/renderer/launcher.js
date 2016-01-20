import reactDOM from 'react-dom'
import React, {Component} from '../react/base-react'
import {showMainWindow} from '../react/local-debug.desktop'
import {Provider} from 'react-redux'
import RemoteStore from './remote-store.desktop'
import Menubar from '../react/menubar'
import consoleHelper from '../app/console-helper'

consoleHelper()

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
