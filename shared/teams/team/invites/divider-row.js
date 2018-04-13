// @flow
import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

export default (index, {key}) => (
  <Box
    key={key}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
      <Text style={{color: globalColors.black_40}} type="BodySmall">
        {key}
      </Text>
    </Box>
  </Box>
)
