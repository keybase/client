'use strict'
/* @flow */

import React, { AppRegistry, Component } from 'react-native'
import { Provider, connect } from 'react-redux/native'
import configureStore from './store/configure-store'
import Nav from './nav'

const store = configureStore()

class Keybase extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <Provider store={store}>
        {() => {
          // TODO(mm): maybe not pass in store?
          return React.createElement(connect(state => state)(Nav), {store: store})
        }}
      </Provider>
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
