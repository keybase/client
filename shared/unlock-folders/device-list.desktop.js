// @flow

import React, {Component} from 'react'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {Text, Button, Icon} from '../common-adapters'

import type {Device} from '../constants/unlock-folders'

export type Props = {
  devices: ?Array<Device>,
  toPaperKeyInput: () => void,
}

class DeviceRow extends Component<void, {device: Device}, void> {
  render() {
    const icon = {
      desktop: 'icon-computer-32',
      backup: 'icon-paper-key-32',
      mobile: 'icon-phone-32',
    }[this.props.device.type]

    return (
      <div style={{...globalStyles.flexBoxRow, marginBottom: 16}}>
        <div style={deviceRowStyles.iconWrapper}>
          <Icon type={icon} style={{height: 22}} />
        </div>
        <Text type="BodySemiboldItalic" style={{marginLeft: 16}}>
          {this.props.device.name}
        </Text>
      </div>
    )
  }
}

export default class DeviceList extends Component<void, Props, void> {
  render() {
    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text type="Body" style={styles.infoText}>
          This computer and possibly others are unable to read some of your folders. To avoid losing data forever, please turn on one of the devices below:
        </Text>
        <div style={styles.devicesContainer}>
          {this.props.devices &&
            this.props.devices.map(d => (
              <DeviceRow key={d.deviceID} device={d} />
            ))}
        </div>
        <div style={styles.buttonsContainer}>
          <Button
            type="Secondary"
            label="Enter a paper key instead"
            style={styles.enterPaperKey}
            onClick={this.props.toPaperKeyInput}
          />
        </div>
      </div>
    )
  }
}

const styles = {
  infoText: {
    marginTop: 5,
    marginBottom: 8,
    paddingLeft: 55,
    paddingRight: 55,
    textAlign: 'center',
  },

  devicesContainer: {
    height: 162,
    width: 440,
    overflowY: 'scroll',
    backgroundColor: globalColors.lightGrey,
    alignSelf: 'center',
    paddingTop: globalMargins.small,
    paddingBottom: globalMargins.small,
  },

  buttonsContainer: {
    ...globalStyles.flexBoxRow,
    marginTop: globalMargins.small,
    marginRight: 30,
    alignSelf: 'center',
  },

  enterPaperKey: {
    height: 32,
    width: 236,
    marginRight: 7,
  },

  accessFolders: {
    marginRight: 0,
  },
}

const deviceRowStyles = {
  iconWrapper: {
    width: 24,
    marginLeft: 33,
    display: 'flex',
    justifyContent: 'center',
  },
}
