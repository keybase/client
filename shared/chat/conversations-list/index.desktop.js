// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

const ConversationList = () => (
  <Box style={{...globalStyles.flexBoxColumn, flow: 1, backgroundColor: globalColors.darkBlue4, width: 240}}>
    <Text type='Body' backgroundMode='Terminal'>Conversations</Text>
    <Text type='Body' backgroundMode='Terminal'>Todo</Text>
  </Box>
)

export default ConversationList
