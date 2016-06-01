// @flow

import React from 'react'
import type {Props} from './index.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props as IconProps} from '../../common-adapters/icon'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel}: Props) => {
  const icon: IconProps.type = {
    'mobile': 'phone-color-revoke-m',
    'desktop': 'computer-bw-revoke-m',
    'backup': 'paper-key-remove-m'
  }[type]

  return (
    <Confirm theme='public' danger submitLabel='Yes, delete it' onSubmit={() => onSubmit({deviceID, name, currentDevice})} onCancel={onCancel}>
      <Box style={{...globalStyles.flexBoxColumn, minHeight: 80, marginBottom: 16, alignItems: 'center'}}>
        <Icon type={icon} />
        <Text type='Body' style={stylesName}>{name}</Text>
      </Box>
      <Text type='Header'>Are you sure you want to revoke {currentDevice ? 'your current device' : name}?</Text>
    </Confirm>
  )
}

const stylesName = {
  textDecoration: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
  flow: 1
}

export default Render
