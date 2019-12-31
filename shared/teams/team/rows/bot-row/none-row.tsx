import * as React from 'react'
import {Box, Text} from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const NoBotRow = () => (
  <Box style={styles.container}>
    <Box style={styles.textContainer}>
      <Text type="BodySmall">This team has no bots.</Text>
    </Box>
  </Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        padding: Styles.globalMargins.tiny,
        width: '100%',
      },
      textContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
      },
    } as const)
)

export default NoBotRow
