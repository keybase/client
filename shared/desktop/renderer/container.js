// @flow
import React from 'react'
import {Provider} from 'react-redux'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../../styles/material-theme.desktop'

const Root = ({store, children}: any) => (
  <MuiThemeProvider muiTheme={materialTheme}>
    <Provider store={store}>
      {children}
    </Provider>
  </MuiThemeProvider>
)

export default Root
