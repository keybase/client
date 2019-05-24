import * as React from 'react'
import {Box, CopyableText, HeaderOnMobile, Text} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

type Props = {
  onBack: () => void
  text: string
}

const ConversationError = ({text}: Props) => (
  <Box style={styleContainer}>
    <Text type="Header">There was an error loading this conversation.</Text>
    <Text style={styleBody} type="Body">
      The error is:
    </Text>
    <Box style={styleErrorBox}>
      <CopyableText style={styleErrorText} value={text} />
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

export default HeaderOnMobile(ConversationError)
