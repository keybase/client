// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

const MessageLoadingMore = () => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Text type='BodySmall'>ヽ(ಠ益ಠ)ノ</Text>
    <Text type='BodySmall'>Digging ancient messages...</Text>
  </Box>
)

export default MessageLoadingMore
