// @flow
import Menubar from '../shared/menubar'
import React, {Component} from 'react'
import RemoteStore from './remote-store.desktop'
import hello from '../shared/util/hello'
import loadPerf from '../shared/util/load-perf'
import materialTheme from '../shared/styles/material-theme.desktop'
import reactDOM from 'react-dom'
import {MuiThemeProvider} from 'material-ui/styles'
import {Provider} from 'react-redux'
import {ipcLogsRenderer} from '../app/console-helper'
import {makeEngine} from '../shared/engine'
import {remote} from 'electron'
import {setupContextMenu} from '../app/menu-helper'

ipcLogsRenderer()
makeEngine()
hello(process.pid, 'Menubar', process.argv, __VERSION__) // eslint-disable-line no-undef

if (module.hot) {
  // $FlowIssue
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
