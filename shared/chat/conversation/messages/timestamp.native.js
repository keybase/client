// @flow
// import React from 'react'

import React from 'react'
import {Text, Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import type {Props} from './timestamp'

const Timestamp = ({timestamp, style}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, ...style}}>
    <Text type='BodySmallSemibold'>{timestamp}</Text>
  </Box>
)

export default Timestamp
