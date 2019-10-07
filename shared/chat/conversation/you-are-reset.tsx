import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import * as Styles from '../../styles'

const YouAreReset = () => (
  <Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
    <Box
      style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}
    >
      <Icon type={Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Box>
    <Box style={styles.box}>
      <Text type="BodySemibold" negative={true} style={{textAlign: 'center' as const}}>
        Since you reset your account, participants have to accept to let you back in.
      </Text>
    </Box>
  </Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.red,
        padding: Styles.globalMargins.small,
      },
    } as const)
)

export default YouAreReset
