/* @flow */

import React, {Component} from '../../react-native/react/base-react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from '../../react-native/react/store/configure-store'
import Nav from '../../react-native/react/nav'
import injectTapEventPlugin from 'react-tap-event-plugin'
import {isDev} from '../../react-native/react/constants/platform'

let DevTools = null
let DebugPanel = null
let LogMonitor = null

if (isDev) {
  const RDT = require('redux-devtools/lib/react')
  DevTools = RDT.DevTools
  DebugPanel = RDT.DebugPanel
  LogMonitor = RDT.LogMonitor
}

const store = configureStore()

class Keybase extends Component {
  constructor () {
    super()

    // Used by material-ui widgets.
    injectTapEventPlugin()
  }

  renderNav () {
    return (
      <Provider store={store}>
        <Nav />
      </Provider>
    )
  }

  render () {
    if (isDev) {
      return (
        <div>
          <DebugPanel top right bottom>
            <DevTools store={store} monitor={LogMonitor} visibleOnLoad/>
          </DebugPanel>
          {this.renderNav()}
        </div>
      )
    } else {
      return this.renderNav()
    }
  }
}

ReactDOM.render(<Keybase/>, document.getElementById('app'))
