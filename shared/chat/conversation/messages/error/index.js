// @flow
import React from 'react'
import {Text, Box} from '../../../../common-adapters'
import {globalStyles, globalColors} from '../../../../styles'

export type Props = {
  reason: string,
}

const Error = ({reason}: Props) => (
  <Box style={errorStyle}>
    <Text type='BodySmallItalic' style={textStyle}>{reason}</Text>
  </Box>
)

const textStyle = {
  color: globalColors.red,
}

const errorStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  padding: 5,
}

export default Error
