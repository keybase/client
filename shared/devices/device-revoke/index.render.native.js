// @flow

import React from 'react'
import type {Props} from './index.render'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props as IconProps} from '../../common-adapters/icon'

const Render = ({name, type, isCurrent, onSubmit, onCancel}: Props) => {
  const icon: IconProps.type = {
    'mobile': 'phone-color-revoke-m',
    'desktop': 'computer-bw-revoke-m',
    'backup': 'paper-key-remove-m'
  }[type]

  return (
    <Box style={stylesContainer}>
      <Text type='BodyPrimaryLink' style={{alignSelf: 'flex-start'}} onClick={onCancel}>Cancel</Text>
      <Box style={{...globalStyles.flexBoxColumn, marginTop: 100, marginBottom: 56, alignItems: 'center'}}>
        <Icon type={icon} />
        <Text type='Body' style={stylesName}>{name}</Text>
      </Box>
      <Text type='Header' style={{flex: 1, textAlign: 'center'}}>Are you sure you want to revoke {isCurrent ? 'your current device' : name}?</Text>
      <Button type='Danger' onClick={onSubmit} label='Yes, delete it' style={stylesButton}/>
      <Button type='Secondary' onClick={onCancel} label='Cancel' style={stylesButton}/>
    </Box>)
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'center',
  padding: 16,
  flex: 1
}

const stylesName = {
  textDecorationLine: 'line-through',
  color: globalColors.red,
  margin: 32,
  fontStyle: 'italic',
  marginTop: 2,
  flex: 1
}

const stylesButton = {
  alignSelf: 'stretch',
  marginBottom: 8
}

export default Render
