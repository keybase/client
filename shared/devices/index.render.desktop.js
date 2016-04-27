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
    this.toggleHeader = this.toggleHeader.bind(this)
  }

  toggleHeader () {
    this.setState({expanded: !this.state.expanded})
  }

  render () {
    const iconType = this.state.expanded ? 'fa-caret-down' : 'fa-caret-up'
    return (
      <Box>
        <Box style={stylesRevokedRow} onClick={this.toggleHeader}>
          <Text type='BodySemibold'>Revoked devices</Text>
          <Icon type={iconType} style={{padding: 5}}/>
        </Box>
        {this.state.expanded && this.props.children}
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

const RevokedDevices = revokedDevices => {
  return (
    <RevokedHeader>
      <RevokedDescription/>
      {revokedDevices.map(device => DeviceRow({device, revoked: true, showRemoveDevicePage: () => {}, showExistingDevicePage: () => {}}))}
    </RevokedHeader>
  )
}

const DeviceHeader = addNewDevice => {
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

const DeviceRow = ({device, revoked, showRemoveDevicePage, showExistingDevicePage}) => {
  const icon: IconProps.type = {
    'mobile': 'phone-bw-m',
    'desktop': 'computer-bw-s-2',
    'backup': 'paper-key-m'
  }[device.type]

  let textStyle = {fontStyle: 'italic'}
  if (revoked) {
    textStyle = {
      ...textStyle,
      color: globalColors.black40,
      textDecoration: 'line-through'
    }
  }

  return (
    <Box key={device.name} style={{...stylesCommonRow, backgroundColor: revoked ? globalColors.lightGrey : globalColors.white}} onClick={showExistingDevicePage}>
      <Box style={revoked ? stylesRevokedIconColumn : stylesIconColumn}>
        <Icon type={icon}/>
      </Box>
      <Box style={stylesCommonColumn}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text style={textStyle} type='Header'>{device.name}</Text>
        </Box>
        <Box style={{...globalStyles.flexBoxRow}}>
          {device.isCurrent && <Text type='BodySmall'>Current device</Text>}
        </Box>
      </Box>
      <Box style={{...stylesRevokedColumn}}>
        {!revoked && <Text style={{color: globalColors.red}} type='BodyPrimaryLink'>Revoke</Text>}
      </Box>
    </Box>
  )
}

const Render = ({devices, revokedDevices, waitingForServer, addNewDevice, showRemoveDevicePage, showExistingDevicePage}: Props) => {
  return (
    <Box style={stylesContainer}>
      {DeviceHeader(addNewDevice)}
      {devices && devices.map(device => DeviceRow({device, revoked: false, showRemoveDevicePage, showExistingDevicePage}))}
      {revokedDevices && RevokedDevices(revokedDevices)}
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
