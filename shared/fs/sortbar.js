// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../styles'
import {Box, Divider} from '../common-adapters'

const SortBar = () => (
  <Box>
    <Divider />
    <Box style={stylesSortBar} />
  </Box>
)

const stylesSortBar = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'start',
  backgroundColor: globalColors.blue5,
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  minHeight: isMobile ? 24 : 24,
}

export default SortBar
