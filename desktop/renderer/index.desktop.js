'use strict'
/* @flow */

import BaseComponent from '../../react-native/react/base-component'
import React from 'react'
import ReactDOM from 'react-dom'
import { Provider, connect } from 'react-redux'
import configureStore from '../../react-native/react/store/configure-store'
import Nav from '../../react-native/react/nav'
import { DevTools, DebugPanel, LogMonitor } from 'redux-devtools/lib/react'
import injectTapEventPlugin from 'react-tap-event-plugin'
import { enableNotifications, bindNotifications } from '../../react-native/react/native/notifications'
const store = configureStore()

class Keybase extends BaseComponent {
  constructor () {
    super()

    // Used by material-ui widgets.
    injectTapEventPlugin()

    // Bind Notifications
    enableNotifications()
    this.unbindNotifications = bindNotifications()
  }

  componentWillUnmount () {
    this.unbindNotifications()
  }

  render () {
    return (
      <div>
        <DebugPanel top right bottom>
          <DevTools store={store} monitor={LogMonitor} visibleOnLoad/>
        </DebugPanel>
        <Provider store={store}>
          {() => {
            // TODO(mm): maybe not pass in store?
            return React.createElement(connect(state => state)(Nav), {store: store})
          }}
        </Provider>
      </div>
    )
  }
}

ReactDOM.render(<Keybase/>, document.getElementById('app'))
