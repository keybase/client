// @flow
import React from 'react'
import {globalColors, globalStyles} from '../../../styles'
import {Text} from '../../../common-adapters'

const Retry = ({failureDescription, onRetry}: {failureDescription?: ?string, onRetry: () => void}) => {
  const error = `> Failed to send${failureDescription ? ` -  ${failureDescription}` : ''}. `
  return (
    <Text type='BodySmall'>
      <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
      <Text type='BodySmall' style={{color: globalColors.red}}>{error}</Text>
      <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onRetry}>Retry</Text>
    </Text>
  )
}

export default Retry
