import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

const NoConversation = () => (
  <Box style={containerStyle}>
    <Icon type="icon-fancy-chat-72-x-52" style={{marginBottom: globalMargins.small}} />
    <Text type="BodySmallSemibold" negative={true} style={{color: globalColors.black_50}}>
      All conversations are end-to-end encrypted.
    </Text>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  flex: 1,
  justifyContent: 'center',
}

export default NoConversation
