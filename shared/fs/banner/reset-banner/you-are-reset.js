// @flow
import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

const YouAreReset = () => (
  <Box style={containerStyle}>
    <Box style={textContainerStyle}>
      <Text type="BodySemibold" backgroundMode="Terminal" style={textStyle}>
        Since you reset your account, participants have to accept to let you back in.
      </Text>
    </Box>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const textContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  padding: globalMargins.small,
}

const textStyle = {
  textAlign: 'center',
}

export default YouAreReset
