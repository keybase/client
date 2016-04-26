/* @flow */
import React from 'react'
import {Box, Text, Icon, Button} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props as IconProps} from '../common-adapters/icon'

import moment from 'moment'
import commonStyles from '../styles/common'

import type {Props} from './index'
import type {Device as DeviceType} from '../constants/types/flow-types'

const DeviceHeader = () => {
  return (
    <Box style={stylesCommonRow}>
      <Box style={stylesCommonColumn}>
        <Icon type='computer-bw-xs'/>
        <Icon type='paper-key-m'/>
      </Box>
      <Box style={stylesCommonColumn}>
        <Text type='BodyPrimaryLink'>Add new...</Text>
      </Box>
    </Box>
  )
}

const RevokedHeader = () => {
  return (
    <Box style={stylesRevokedRow}>
      <Text type='BodySemibold'>Revoked devices</Text>
    </Box>
  )
}

const RevokedDescription = () => {
  return (
    <Box style={stylesRevokedDescription}>
      <Text type='BodySemibold' style={{color: globalColors.black40}}>Revoked devices will no longer be able to access your Keybase account.</Text>
    </Box>
  )
}

const DeviceRow = ({device, revoked}) => {
  const icon: IconProps.type = {
    'mobile': 'phone-bw-m',
    'desktop': 'computer-bw-m',
    'backup': 'paper-key-m'
  }[device.type]

  return (
    <Box style={{...stylesCommonRow, backgroundColor: revoked ? '#f0f0f0' : globalColors.white}}>
      <Box style={{...stylesCommonColumn, width: 85}}>
        <Icon type={icon}/>
      </Box>
      <Box style={stylesCommonColumn}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text style={{fontStyle: 'italic'}} type='Header'>{device.name}</Text>
        </Box>
        <Box style={{...globalStyles.flexBoxRow}}>
          {device.isCurrent && <Text type='BodySmall'>Current device</Text>}
        </Box>
      </Box>
      <Box style={{...stylesCommonColumn, alignSelf: 'center', flex: 1, textAlign: 'right', paddingRight: 20}}>
        <Text style={{color: globalColors.red}} type='BodyPrimaryLink'>Revoke</Text>
      </Box>
    </Box>
  )
}

const Render = ({devices, revokedDevices, waitingForServer, showRemoveDevicePage, showExistingDevicePage, showGenPaperKeyPage}: Props) => {
  return (
    <Box style={stylesContainer}>
      <DeviceHeader/>
      {devices && devices.map(device => DeviceRow({device, revoked: false}))}
      <RevokedHeader/>
      <RevokedDescription/>
      {revokedDevices && revokedDevices.map(device => DeviceRow({device, revoked: true}))}
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
  backgroundColor: '#f0f0f0'
}

const stylesRevokedDescription = {
  ...stylesCommonRow,
  backgroundColor: '#f0f0f0'
}

const stylesCommonColumn = {
  padding: 20
}
export default Render
