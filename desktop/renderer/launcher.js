import reactDOM from 'react-dom'
import React, {Component} from 'react'
import {Provider} from 'react-redux'
import RemoteStore from './remote-store.desktop'
import Menubar from '../shared/menubar'
import {ipcLogsRenderer} from '../app/console-helper'
import hello from '../shared/util/hello'
import {setupContextMenu} from '../app/menu-helper'
import loadPerf from '../shared/util/load-perf'
import {remote} from 'electron'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../shared/styles/material-theme.desktop'

ipcLogsRenderer()
hello(process.pid, 'Menubar', process.argv, __VERSION__) // eslint-disable-line no-undef

if (module.hot) {
  module.hot.accept()
}

const store = new RemoteStore({component: 'menubar'})

class RemoteMenubar extends Component {
  constructor () {
    super()
    loadPerf()
  }
  render () {
    return (
      <MuiThemeProvider muiTheme={materialTheme}>
        <Provider store={store}>
          <Menubar />
        </Provider>
      </MuiThemeProvider>
    )
  }
}

reactDOM.render(React.createElement(RemoteMenubar), document.getElementById('root'))
setupContextMenu(remote.getCurrentWindow())
