// @flow

import React from 'react'
import type {Props} from './index.render'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props as IconProps} from '../../common-adapters/icon'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel}: Props) => {
  const icon: IconProps.type = {
    'mobile': 'phone-color-revoke-m',
    'desktop': 'computer-bw-revoke-m',
    'backup': 'paper-key-remove-m'
  }[type]

  return (
    <Box style={stylesContainer}>
      <Icon style={stylesClose} type='fa-close' onClick={onCancel} />
      <Box style={{...globalStyles.flexBoxColumn, minHeight: 80, marginBottom: 16, alignItems: 'center'}}>
        <Icon type={icon} />
        <Text type='Body' style={stylesName}>{name}</Text>
      </Box>
      <Text type='Header'>Are you sure you want to revoke {currentDevice ? 'your current device' : name}?</Text>
      <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
        <Button type='Secondary' onClick={onCancel} label='Cancel' />
        <Button type='Danger' onClick={() => onSubmit({deviceID, name, currentDevice})} label='Yes, delete it' />
      </Box>
    </Box>)
}

const stylesName = {
  textDecoration: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 2,
  flow: 1
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  paddingTop: 64,
  paddingBottom: 64,
  alignItems: 'center',
  position: 'relative'
}

const stylesClose = {
  position: 'absolute',
  right: 0,
  top: 0
}

export default Render
