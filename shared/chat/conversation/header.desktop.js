// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

const Header = ({participants}: Props) => (
  <Box style={containerStyle}>
    <Text type='Body'>{participants.join(', ')}</Text>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32,
  borderBottom: `solid 1px ${globalColors.black_05}`,
  justifyContent: 'center',
  alignItems: 'center',
}

export default Header
