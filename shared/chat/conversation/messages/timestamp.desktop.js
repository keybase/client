// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import type {Props} from './timestamp'

const Timestamp = ({timestamp, style}: Props) => (
  <Box key={timestamp} style={{...globalStyles.flexBoxRow, ...style}}>
    <Text style={styleText} type='BodySmall'>{timestamp}</Text>
  </Box>
)

export const styleText = {
  padding: globalMargins.xtiny,
  flex: 1,
  textAlign: 'center',
  color: globalColors.black_40,
}
export default Timestamp
