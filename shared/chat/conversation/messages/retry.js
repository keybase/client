// @flow
import React from 'react'
import {globalColors} from '../../../styles'
import {Box, Text} from '../../../common-adapters'

const Retry = ({onRetry}: {onRetry: () => void}) => (
  <Box>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, textDecoration: 'underline'}} onClick={onRetry}>Retry</Text>
  </Box>
)

export default Retry
