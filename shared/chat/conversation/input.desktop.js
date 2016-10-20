// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

const Conversation = () => (
  <Box style={{...globalStyles.flexBoxRow, minHeight: 48, borderTop: `solid 1px ${globalColors.black_05}`}}>
    <Text type='Body'>Input: Todo</Text>
  </Box>
)

export default Conversation
