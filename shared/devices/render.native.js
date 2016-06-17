/* @flow */
import React, {Component} from 'react'
import {View} from 'react-native'
import {TouchableHighlight} from 'react-native'

import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props as IconProps} from '../common-adapters/icon'

import type {Props} from './render'

type RevokedHeaderProps = {children?: Array<any>}
type RevokedHeaderState = {expanded: boolean}
class RevokedHeader extends Component<void, RevokedHeaderProps, RevokedHeaderState> {
  state: RevokedHeaderState;

  constructor (props: Props) {
    super(props)
    this.state = {
      expanded: false,
    }
  }

  _toggleHeader (e) {
    this.setState({expanded: !this.state.expanded})
  }

  render () {
    const iconType = this.state.expanded ? 'fa-caret-down' : 'fa-caret-up'
    return (
      <Box>
        <TouchableHighlight onPress={e => this._toggleHeader(e)}>
          <Box style={stylesRevokedRow}>
            <Text type='BodySemibold'>Revoked devices</Text>
            <Icon type={iconType} style={{padding: 5}} />
          </Box>
        </TouchableHighlight>
        {this.state.expanded && this.props.children}
      </Box>
    )
  }
}

const DeviceRow = ({device, revoked, showRemoveDevicePage, showExistingDevicePage}) => {
  const icon: IconProps.type = {
    'mobile': 'phone-bw-m',
    'desktop': 'computer-bw-s-2',
    'backup': 'paper-key-m',
  }[device.type]

  let textStyle = {fontStyle: 'italic'}
  if (revoked) {
    textStyle = {
      ...textStyle,
      color: globalColors.black_40,
      textDecorationLine: 'line-through',
      textDecorationStyle: 'solid',
    }
  }

  return (
    <Box key={device.name} style={{...stylesCommonRow, backgroundColor: revoked ? globalColors.lightGrey : globalColors.white}}>
      <Box style={revoked ? stylesRevokedIconColumn : stylesIconColumn}>
        <Icon type={icon} />
      </Box>
      <TouchableHighlight onPress={() => showExistingDevicePage(device)} style={stylesCommonColumn}>
        <View>
          <View style={{...globalStyles.flexBoxRow}}>
            <Text style={textStyle} type='BodySemibold'>{device.name}</Text>
          </View>
          <View style={{...globalStyles.flexBoxRow}}>
            {device.currentDevice && <Text type='BodySmall'>Current device</Text>}
          </View>
        </View>
      </TouchableHighlight>
      <TouchableHighlight onPress={() => showRemoveDevicePage(device)} style={stylesRevokedColumn}>
        <View>
          {!revoked && <Text style={{color: globalColors.red}} type='BodyPrimaryLink'>Revoke</Text>}
        </View>
      </TouchableHighlight>
    </Box>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmallSemibold' style={{color: globalColors.black_40, textAlign: 'center'}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

const RevokedDevices = ({revokedDevices}) => (
  <RevokedHeader>
    <RevokedDescription />
    {revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked />)}
  </RevokedHeader>
)

const DeviceHeader = ({addNewDevice}) => (
  <Box style={stylesCommonRow}>
    <Box style={stylesCommonColumn}>
      <Icon type='devices-add-s' />
    </Box>
    <Box style={stylesCommonColumn}>
      <Text type='BodyPrimaryLink' onPress={addNewDevice}>Add new...</Text>
    </Box>
  </Box>
)

// TODO native popup
const Render = ({devices, revokedDevices, waitingForServer, showRemoveDevicePage, showExistingDevicePage}: Props) => (
  <Box style={stylesContainer}>
    {<DeviceHeader addNewDevice={() => {}} />}
    {devices && devices.map(device => <DeviceRow key={device.name} device={device} showRemoveDevicePage={showRemoveDevicePage} showExistingDevicePage={showExistingDevicePage} />)}
    {revokedDevices && <RevokedDevices revokedDevices={revokedDevices} />}
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
}

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_10,
  borderBottomWidth: 1,
  height: 60,
  justifyContent: 'center',
  padding: 8,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
}

const stylesRevokedRow = {
  ...stylesCommonRow,
  height: 30,
  justifyContent: 'flex-start',
  backgroundColor: globalColors.lightGrey,
}

const stylesRevokedDescription = {
  ...globalStyles.flexBoxColumn,
  ...stylesCommonCore,
  backgroundColor: globalColors.lightGrey,
}

const stylesCommonColumn = {
  padding: 5,
}

const stylesRevokedColumn = {
  ...stylesCommonColumn,
  flex: 1,
  alignItems: 'flex-end',
}

const stylesIconColumn = {
  ...stylesCommonColumn,
  width: 85,
}

const stylesRevokedIconColumn = {
  ...stylesIconColumn,
  opacity: 0.2,
}

export default Render
