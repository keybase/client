/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {configure, addDecorator} from '@storybook/react'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import materialTheme from '../styles/material-theme.desktop'

// Load css
import '../desktop/renderer/style.css'

const load = () => {
  // Load common-adapter stories
  // $FlowIssue
  const req = require.context('..', true, /\.stories\.js$/)

  // Add material-ui dependency
  addDecorator(story => (
    <MuiThemeProvider muiTheme={materialTheme}>
      <ScrollView key="scrollview" style={{flex: 1}}>
        {story()}
      </ScrollView>
    </MuiThemeProvider>
  ))

  configure(() => {
    req.keys().forEach(filename => {
      req(filename).default()
    })
  }, module)
}

export default load
