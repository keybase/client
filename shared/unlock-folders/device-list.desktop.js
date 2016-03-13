// @flow

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import {Text, Button, Icon} from '../common-adapters'

import type {Device} from '../constants/unlock-folders'

export type Props = {
  devices: ?Array<Device>,
  toPaperKeyInput: () => void
}

class DeviceRow extends Component<void, {device: Device}, void> {
  render () {
    const isDesktop = this.props.device.type === 'desktop'
    return (
      <div style={{...globalStyles.flexBoxRow, marginBottom: 16}}>
        <div style={{width: 24, marginLeft: 33, display: 'flex', justifyContent: 'center'}}>
          <Icon type={isDesktop ? 'computer-big' : 'phone-big'} style={{height: 21}}/>
        </div>
        <Text type='BodySemibold' style={{...globalStyles.italic, marginLeft: 16, cursor: 'default'}}>{this.props.device.name}</Text>
      </div>
    )
  }
}

export default class DeviceList extends Component<void, Props, void> {
  render () {
    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text type='Body' style={styles.infoText}>Turn on one of your devices to unlock your folders:</Text>
        <div style={styles.devicesContainer}>
          {this.props.devices && this.props.devices.map(d => <DeviceRow device={d}/>)}
        </div>
        <div style={styles.buttonsContainer}>
          <Button type='Secondary' label='Enter a paper key instead' style={styles.enterPaperKey}
            onClick={this.props.toPaperKeyInput}/>
          <Button type='Primary' label='Access my folders' disabled style={styles.accessFolders}
            onClick={() => {}}/>
        </div>
      </div>
    )
  }
}

const styles = {
  infoText: {
    marginTop: 30,
    marginBottom: 8,
    textAlign: 'center'
  },

  devicesContainer: {
    height: 162,
    width: 440,
    overflowY: 'scroll',
    backgroundColor: globalColors.lightGrey,
    alignSelf: 'center',
    paddingTop: 15,
    paddingBottom: 15
  },

  buttonsContainer: {
    ...globalStyles.flexBoxRow,
    marginTop: 15
  },

  enterPaperKey: {
    height: 32,
    width: 236
  },

  accessFolders: {
  }
}
