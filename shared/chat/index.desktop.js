// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'
import ConversationList from './conversation-list/container'
import Conversation from './conversation/container'

const ChatRender = () => (
  <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
    <ConversationList />
    <Conversation />
  </Box>
)

export default ChatRender
