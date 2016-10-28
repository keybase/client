// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

const Header = () => (
  <Box style={{...globalStyles.flexBoxRow, minHeight: 32, borderBottom: `solid 1px ${globalColors.black_05}`}}>
    <Text type='Body'>Header: Todo</Text>
  </Box>
)

export default Header
