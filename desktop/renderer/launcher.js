import reactDOM from 'react-dom'
import React, {Component} from 'react'
import {showMainWindow} from '../shared/local-debug.desktop'
import {Provider} from 'react-redux'
import RemoteStore from './remote-store.desktop'
import Menubar from '../shared/menubar'
import consoleHelper from '../app/console-helper'
import hello from '../shared/util/hello'

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
