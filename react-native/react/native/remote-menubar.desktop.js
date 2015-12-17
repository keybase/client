/* @flow */
/* eslint-disable react/prop-types */
import React, {Component} from '../base-react'

import {Provider} from 'react-redux'
import RemoteStore from './remote-store.desktop'

import Menubar from '../menubar'

const store = new RemoteStore({})

export default class RemoteMenubar extends Component {
  props: {
    onSizeChange: () => void,
    debug: ?boolean
  };

  componentDidUpdate () {
    this.props.onSizeChange()
  }

  componentDidMount () {
    this.props.onSizeChange()
    store.subscribe(() => {
      this.props.onSizeChange()
    })
  }

  render () {
    return (
      <Provider store={store}>
        <Menubar debug={!!this.props.debug}/>
      </Provider>
    )
  }
}
