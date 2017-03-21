// @flow
import React from 'react'
import {globalColors, globalStyles} from '../../../styles'
import {Box, Text} from '../../../common-adapters'

const Failure = ({failureDescription, onShowEditor, onRetry}: {failureDescription?: ?string, onRetry: () => void, onShowEditor: (event: any) => void}) => {
  const error = `Failed to send${failureDescription ? ` -  ${failureDescription}` : ''}. `
  const resolveByEdit = failureDescription === 'message is too long'
  return (
    <Text type='BodySmall'>
      <Text type='BodySmall' style={{color: globalColors.red, fontSize: 9}}>{'┏(>_<)┓'}</Text>
      <Text type='BodySmall' style={{color: globalColors.red}}> {error}</Text>
      {resolveByEdit &&
        <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onShowEditor}>Edit</Text>}
      {!resolveByEdit &&
        <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onRetry}>Retry</Text>}
    </Text>
  )
}

export default Failure
