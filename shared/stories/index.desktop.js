/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import {configure, addDecorator} from '@storybook/react'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import materialTheme from '../styles/material-theme.desktop'

// Load css
import '../desktop/renderer/style.css'

const load = () => {
  // Load common-adapter stories
  // $FlowIssue
  const req = require.context('../common-adapters', true, /\.stories(\.desktop)?\.js$/)

  // Add material-ui dependency
  addDecorator(story => (
    <MuiThemeProvider muiTheme={materialTheme}>
      {story()}
    </MuiThemeProvider>
  ))

  configure(() => {
    req.keys().forEach(filename => req(filename))
  }, module)
}

export default load
