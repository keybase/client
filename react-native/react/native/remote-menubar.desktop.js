/* @flow */

import {remote} from 'electron'

import React, {Component} from '../base-react'

import {Provider} from 'react-redux'
import RemoteStore from './remote-store'

import Menubar from '../menubar'

const store = new RemoteStore({})

export default class RemoteMenubar extends Component {
  render () {
    return (
      <Provider store={store}>
        <Menubar/>
      </Provider>
    )
  }
}
