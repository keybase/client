// @flow
import React from 'react'
import {globalColors} from '../../../styles'
import {Text} from '../../../common-adapters'

const Retry = ({onRetry}: {onRetry: () => void}) => (
  <div>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, textDecoration: 'underline'}} onClick={onRetry}>Retry</Text>
  </div>
)

export default Retry
