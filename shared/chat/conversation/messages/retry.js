// @flow
import React from 'react'
import {globalColors, globalStyles} from '../../../styles'
import {Text} from '../../../common-adapters'

const Retry = ({onRetry}: {onRetry: () => void}) => (
  <Text type='BodySmall'>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onRetry}>Retry</Text>
  </Text>
)

export default Retry
