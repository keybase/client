// @flow
import './style.css'

import React from 'react'
import ReactDOM from 'react-dom'
import injectTapEventPlugin from 'react-tap-event-plugin'
import {AppContainer} from 'react-hot-loader'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../../styles/material-theme.desktop'
import {GlobalEscapeHandler} from '../../util/escape-handler'

module.hot && module.hot.accept('../../dev/dumb-sheet/render.desktop', render)

class Wrapper extends React.Component<any, any, any> {
  constructor() {
    super()
    this.state = {
      // eslint-disable-next-line
      dumbFilter: localStorage['dumbFilter'] || '',
    }
  }

  render() {
    const {dumbFilter} = this.state
    const {DumbSheet} = this.props
    return (
      <DumbSheet
        onBack={() => {}}
        onDebugConfigChange={c => {
          this.setState(c)
          // eslint-disable-next-line
          localStorage['dumbFilter'] = c.dumbFilter
        }}
        dumbIndex={0}
        dumbFilter={dumbFilter || ''}
        dumbFullscreen={false}
        autoIncrement={false}
      />
    )
  }
}

function render() {
  const DumbSheet = require('../../dev/dumb-sheet/render.desktop').default
  ReactDOM.render(
    <AppContainer>
      <MuiThemeProvider muiTheme={materialTheme}>
        <GlobalEscapeHandler>
          <Wrapper DumbSheet={DumbSheet} />
        </GlobalEscapeHandler>
      </MuiThemeProvider>
    </AppContainer>,
    document.getElementById('root')
  )
}

function load() {
  // Used by material-ui widgets.
  if (module.hot) {
    // Don't reload this thing if we're hot reloading
    if (module.hot.data === undefined) {
      injectTapEventPlugin()
    }
  } else {
    injectTapEventPlugin()
  }
  render()
}

window.load = load
window.render = render
