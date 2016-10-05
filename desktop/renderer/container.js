// @flow
import React from 'react'
import {Provider} from 'react-redux'
import Nav from '../shared/nav.desktop'
import RemoteManager from './remote-manager'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../shared/styles/material-theme.desktop'
import {reduxDevToolsEnable} from '../shared/local-debug.desktop'

export default function Root ({store}: any) {
  let dt = null
  if (__DEV__ && reduxDevToolsEnable) { // eslint-disable-line no-undef
    const DevTools = require('./redux-dev-tools').default
    dt = <DevTools />
  }

  return (
    <MuiThemeProvider muiTheme={materialTheme}>
      <Provider store={store}>
        <div style={{display: 'flex', flex: 1}}>
          <RemoteManager />
          <Nav />
          {dt}
        </div>
      </Provider>
    </MuiThemeProvider>
  )
}
