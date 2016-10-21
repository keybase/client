// @flow
import React from 'react'
import {Box, Text, Avatar} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

import type {Props} from './text'

const MessageText = ({author, message}: Props) => (
  <Box style={{...globalStyles.flexBoxRow}}>
    <Avatar size={24} username={author} />
    <Text type='Body'>{message}</Text>
  </Box>
)

export default MessageText
