/* @flow */
import React, {Component} from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props as IconProps} from '../common-adapters/icon'

import type {Props} from './index'
import type {Device as DeviceType} from '../constants/types/flow-types'

class RevokedHeader extends Component {
  state: {
    expanded: boolean
  };

  constructor (props) {
    super(props)
    this.state = {
      expanded: false
    }
  }

  _toggleHeader (e) {
    this.setState({expanded: !this.state.expanded})
  }

  render () {
    const iconType = this.state.expanded ? 'fa-caret-down' : 'fa-caret-up'
    return (
      <Box>
        <Box style={stylesRevokedRow} onClick={e => this._toggleHeader(e)}>
          <Text type='BodySemibold'>Revoked devices</Text>
          <Icon type={iconType} style={{padding: 5}} />
        </Box>
        {this.state.expanded && this.props.children}
      </Box>
    )
  }
}

class DeviceRow extends Component {
  state: {
    highlighted: boolean
  };
  props: {
    device: DeviceType,
    revoked?: boolean,
    showRemoveDevicePage?: () => void,
    showExistingDevicePage?: () => void
  };

  constructor (props) {
    super(props)
    this.state = {
      highlighted: false
    }
  }

  _highlighted (h) {
    this.setState({highlighted: h})
  }

  render () {
    const icon: IconProps.type = {
      'mobile': 'phone-bw-m',
      'desktop': 'computer-bw-s-2',
      'backup': 'paper-key-m'
    }[this.props.device.type]

    let textStyle = {fontStyle: 'italic'}
    if (this.props.revoked) {
      textStyle = {
        ...textStyle,
        color: globalColors.black40,
        textDecoration: 'line-through'
      }
    }

    return (
      <Box key={this.props.device.name} onMouseOver={e => this._highlighted(true)} onMouseOut={e => this._highlighted(false)} style={{...stylesCommonRow, backgroundColor: this.props.revoked ? globalColors.lightGrey : globalColors.white}}>
        <Box style={this.props.revoked ? stylesRevokedIconColumn : stylesIconColumn}>
          <Icon type={icon} />
        </Box>
        <Box style={stylesCommonColumn}>
          <Box style={{...globalStyles.flexBoxRow}}>
            <Text style={textStyle} type='Header'>{this.props.device.name}</Text>
          </Box>
          <Box style={{...globalStyles.flexBoxRow}}>
            {this.props.device.isCurrent && <Text type='BodySmall'>Current device</Text>}
          </Box>
        </Box>
        <Box style={{...stylesRevokedColumn}}>
          {!this.props.revoked && this.state.highlighted && <Text style={{color: globalColors.red}} type='BodyPrimaryLink'>Revoke</Text>}
        </Box>
      </Box>
    )
  }
}

const RevokedDescription = () => {
  return (
    <Box style={stylesRevokedDescription}>
      <Text type='BodySemibold' style={{color: globalColors.black40}}>Revoked devices will no longer be able to access your Keybase account.</Text>
    </Box>
  )
}

const RevokedDevices = ({revokedDevices}) => {
  return (
    <RevokedHeader>
      <RevokedDescription/>
      {revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked/>)}
    </RevokedHeader>
  )
}

const DeviceHeader = ({addNewDevice}) => {
  return (
    <Box style={stylesCommonRow}>
      <Box style={stylesCommonColumn}>
        <Icon type='devices-add-s'/>
      </Box>
      <Box style={stylesCommonColumn}>
        <Text type='BodyPrimaryLink' onClick={addNewDevice}>Add new...</Text>
      </Box>
    </Box>
  )
}

const Render = ({devices, revokedDevices, waitingForServer, addNewDevice, showRemoveDevicePage, showExistingDevicePage}: Props) => {
  return (
    <Box style={stylesContainer}>
      {<DeviceHeader addNewDevice={addNewDevice} />}
      {devices && devices.map(device => <DeviceRow key={device.name} device={device} showRemoveDevicePage={showRemoveDevicePage} showExistingDevicePage={showExistingDevicePage}/>)}
      {revokedDevices && <RevokedDevices revokedDevices={revokedDevices} />}
    </Box>
  )
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderTop: 'solid 1px rgba(0, 0, 0, .1)',
  height: 60,
  justifyContent: 'center',
  padding: 8
}

const stylesRevokedRow = {
  ...stylesCommonRow,
  height: 30,
  justifyContent: 'flex-start',
  backgroundColor: globalColors.lightGrey
}

const stylesRevokedDescription = {
  ...stylesCommonRow,
  backgroundColor: globalColors.lightGrey
}

const stylesCommonColumn = {
  padding: 20
}

const stylesRevokedColumn = {
  ...stylesCommonColumn,
  alignSelf: 'center',
  flex: 1,
  textAlign: 'right',
  paddingRight: 20
}

const stylesIconColumn = {
  ...stylesCommonColumn,
  width: 65
}

const stylesRevokedIconColumn = {
  ...stylesIconColumn,
  opacity: 0.2
}

export default Render
