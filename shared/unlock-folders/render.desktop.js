// @flow

import React, {Component} from 'react'

import DeviceList from './device-list.desktop'
import {Header} from '../common-adapters'

import type {Props} from './render'

export default class Render extends Component<void, Props, void> {
  render () {
    let innerComponent

    switch (this.props.phase) {
      case 'dead':
      case 'promptOtherDevice':
        innerComponent = <DeviceList devices={this.props.devices} toPaperKeyInput={this.props.toPaperKeyInput}/>
        break
      case 'paperKeyInput':
      case 'success':
        innerComponent = (<div>todo</div>)
    }

    return (
      <div style={styles.container}>
        <div style={styles.header}><Header icon type='Default' title='' onClose={this.props.onClose}/></div>
        {innerComponent}
      </div>
    )
  }
}

const styles = {
  container: {
    position: 'relative',
    height: 300,
    width: 500
  },

  header: {
    position: 'absolute',
    width: '100%'
  }
}
