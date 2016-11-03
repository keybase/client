// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

import type {Props} from './loading-more'

const MessageLoadingMore = ({style, hasMoreItems}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', ...style, ...(hasMoreItems ? null : {opacity: 0})}}>
    <Text type='BodySmall'>ヽ(ಠ益ಠ)ノ</Text>
    <Text type='BodySmall'>Digging ancient messages...</Text>
  </Box>
)

export default MessageLoadingMore
