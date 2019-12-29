import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

const BigTeamsLabel = () => (
  <Box style={_bigTeamsLabelBox}>
    <Text type="BodySmallSemibold">Big teams</Text>
  </Box>
)

const _bigTeamsLabelBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  minHeight: 24,
}

export {BigTeamsLabel}
