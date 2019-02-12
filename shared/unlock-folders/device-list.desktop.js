// @flow
import React, {Component} from 'react'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {Text, Button, Icon} from '../common-adapters'

import type {_Device} from '../constants/types/unlock-folders'

export type Props = {
  devices: ?Array<_Device>,
  toPaperKeyInput: () => void,
}

class DeviceRow extends Component<{device: _Device}, void> {
  render() {
    const icon = {
      backup: 'icon-paper-key-32',
      desktop: 'icon-computer-32',
      mobile: 'icon-phone-32',
    }[this.props.device.type]

    return (
      <div style={{...globalStyles.flexBoxRow, marginBottom: 16}}>
        <div style={deviceRowStyles.iconWrapper}>
          <Icon type={icon} style={{height: 22}} />
        </div>
        <Text type="BodySemibold" style={{marginLeft: 16}}>
          {this.props.device.name}
        </Text>
      </div>
    )
  }
}

export default class DeviceList extends Component<Props> {
  render() {
    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text center={true} type="Body" style={styles.infoText}>
          This computer and possibly others are unable to read some of your folders. To avoid losing data
          forever, please turn on one of the devices below:
        </Text>
        <div style={styles.devicesContainer}>
          {this.props.devices && this.props.devices.map(d => <DeviceRow key={d.deviceID} device={d} />)}
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
  accessFolders: {
    marginRight: 0,
  },
  buttonsContainer: {
    ...globalStyles.flexBoxRow,
    alignSelf: 'center',
    marginRight: 30,
    marginTop: globalMargins.small,
  },
  devicesContainer: {
    alignSelf: 'center',
    backgroundColor: globalColors.lightGrey,
    height: 162,
    overflowY: 'scroll',
    paddingBottom: globalMargins.small,
    paddingTop: globalMargins.small,
    width: 440,
  },
  enterPaperKey: {
    height: 32,
    marginRight: 7,
    width: 236,
  },
  infoText: {
    marginBottom: 8,
    marginTop: 5,
    paddingLeft: 55,
    paddingRight: 55,
  },
}

const deviceRowStyles = {
  iconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginLeft: 33,
    width: 24,
  },
}
