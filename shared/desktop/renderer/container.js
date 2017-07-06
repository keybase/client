// @flow
import React from 'react'
import {Provider} from 'react-redux'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import materialTheme from '../../styles/material-theme.desktop'
import {GlobalEscapeHandler} from '../../util/escape-handler'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <GlobalEscapeHandler>
    <MuiThemeProvider muiTheme={materialTheme}>
      <Provider store={store}>
        {children}
      </Provider>
    </MuiThemeProvider>
  </GlobalEscapeHandler>
)

export default Root
