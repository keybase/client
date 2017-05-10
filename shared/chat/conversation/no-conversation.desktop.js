// @flow
import React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

const NoConversation = () => (
  <Box style={containerStyle}>
    <Icon
      type="icon-fancy-chat-72-x-52"
      style={{marginBottom: globalMargins.small}}
    />
    <Text
      type="BodySmallSemibold"
      backgroundMode="Terminal"
      style={{color: globalColors.blue3_40}}
    >
      All conversations are end-to-end encrypted.
    </Text>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.darkBlue4,
  borderLeft: `1px solid ${globalColors.black_20}`,
  flex: 1,
  justifyContent: 'center',
}

export default NoConversation
