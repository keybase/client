// @flow
import * as React from 'react'
import {branch} from 'recompose'
import {Box, CopyableText, HeaderHoc, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'

export type Props = {
  conversationErrorText: string,
}

const ConversationError = ({conversationErrorText}: Props) => (
  <Box style={styleContainer}>
    <Text type="Header">There was an error loading this conversation.</Text>
    <Text style={styleBody} type="Body">The error is:</Text>
    <Box style={styleErrorBox}>
      <CopyableText style={styleErrorText} value={conversationErrorText} />
    </Box>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  padding: globalMargins.medium,
  width: '100%',
}

const styleBody = {
  marginTop: globalMargins.small,
}

const styleErrorBox = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
}

const styleErrorText = {
  flexGrow: 1,
}

export default branch(() => isMobile, HeaderHoc)(ConversationError)
