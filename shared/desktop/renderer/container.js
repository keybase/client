// @flow
import React from 'react'
import {Provider} from 'react-redux'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import materialTheme from '../../styles/material-theme.desktop'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <MuiThemeProvider muiTheme={materialTheme}>
    <Provider store={store}>
      {children}
    </Provider>
  </MuiThemeProvider>
)

export default Root
