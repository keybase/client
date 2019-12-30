import * as React from 'react'
import {Box, Text} from '../../../../common-adapters'
import {globalMargins, globalStyles} from '../../../../styles'

const NoBotRow = () => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flexGrow: 1, justifyContent: 'center'}}>
      <Text type="BodySmall">This team has no bots.</Text>
    </Box>
  </Box>
)

export default NoBotRow
