import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {Box, Text} from '../common-adapters'

import {Props} from './subheading'

function SubHeading({children}: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginBottom: 2}}>
      <Text
        style={{color: globalColors.black_50, marginBottom: globalMargins.xtiny}}
        type="BodySmallSemibold"
      >
        {children}
      </Text>
    </Box>
  )
}

export default SubHeading
