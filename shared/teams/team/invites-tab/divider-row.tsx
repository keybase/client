import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

const Divider = ({label}: {label: string}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
      <Text style={{color: globalColors.black_50}} type="BodySmall">
        {label}
      </Text>
    </Box>
  </Box>
)
export default Divider
