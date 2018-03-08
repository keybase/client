// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {type Props} from '.'

const Files = (props: Props) => (
  <Box style={styleFiles}>
    <Text type="BodyBig">Hello</Text>
  </Box>
)

const styleFiles = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  padding: globalMargins.medium,
}

export default Files
