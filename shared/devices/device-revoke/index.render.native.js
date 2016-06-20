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
    'backup': 'paper-key-remove-m',
  }[type]

  const header = (
    <Box style={styleIcon}>
      <Icon type={icon} />
      <Text type='Body' style={stylesName}>{name}</Text>
    </Box>
  )

  const body = <Text type='Header' style={{textAlign: 'center'}}>Are you sure you want to revoke {currentDevice ? 'your current device' : name}?</Text>

  return <Confirm theme='public' danger header={header} body={body} submitLabel='Yes, delete it' onSubmit={() => onSubmit({deviceID, name, currentDevice})} onCancel={onCancel} />
}

const styleIcon = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const stylesName = {
  textDecorationLine: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
}

export default Render
