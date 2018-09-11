// @flow
import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

const BigTeamsLabel = ({isFiltered}: {isFiltered: boolean}) => (
  <Box style={_bigTeamsLabelBox}>
    <Text type="BodySmallSemibold">{isFiltered ? 'Teams' : 'Big teams'}</Text>
  </Box>
)

const _bigTeamsLabelBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  minHeight: 24,
}

export {BigTeamsLabel}
