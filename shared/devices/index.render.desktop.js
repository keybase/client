/* @flow */
import React from 'react'
import {Box, Text, Icon, Button} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props as IconProps} from '../common-adapters/icon'

import moment from 'moment'
import commonStyles from '../styles/common'

import type {Props} from './index'
import type {Device} from '../constants/types/flow-types'

const renderDevice = device => {
  const icon: IconProps.type = {
    'mobile': 'phone-bw-m',
    'desktop': 'computer-bw-m',
    'backup': 'paper-key-m'
  }[device.type]
  const textStyle = {fontStyle: 'italic'}

  return (
    <Box style={{...globalStyles.flexBoxRow, height: 60, borderTop: 'solid 1px rgba(0, 0, 0, .1)', width: 650, alignItems: 'flex-start'}}>
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', width: 85}}>
        <Icon type={icon}/>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'flex-start', alignSelf: 'center', width: 300}}>
        <Text style={textStyle} type='Header'>{device.name}</Text>
      </Box>
    </Box>
  )
}

const Render = ({devices, waitingForServer, showRemoveDevicePage, showExistingDevicePage, showGenPaperKeyPage}: Props) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box style={{...globalStyles.flexBoxRow, marginBottom: 16, height: 60, padding: 20, borderTop: 'solid 1px rgba(0, 0, 0, .1)', width: 650, justifyContent: 'center', alignItems: 'center'}}>
        <Icon type='computer-color-m'/>
        <Icon type='paper-key-m'/>
        <Text type='BodyPrimaryLink'>Add new...</Text>
      </Box>
      {devices && devices.map(device => renderDevice(device))}
    </Box>
  )
}

const styles = {
  deviceContainer: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  deviceOuter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    margin: 10,
    padding: 10
  },
  device: {
    width: 200,
    textAlign: 'center'
  },
  deviceAction: {
    backgroundColor: '#efefef',
    border: 'dashed 2px #999',
    cursor: 'pointer'
  },
  deviceShow: {
    border: 'solid 1px #999'
  },
  deviceIcon: {
    width: 48,
    height: 48,
    textAlign: 'center'
  },
  actionDesc: {
  },

  // These might be good globals
  line1: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical'
  },
  line2: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  line4: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical'
  }
}

export default Render
