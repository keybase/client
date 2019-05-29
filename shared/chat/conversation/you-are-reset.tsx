import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import * as Styles from '../../styles'

const YouAreReset = () => (
  <Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
    <Box
      style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}
    >
      <Icon type={Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      <Icon type="icon-access-denied-266" />
    </Box>
    <Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.red,
        padding: Styles.globalMargins.small,
      }}
    >
      <Text type="BodySemibold" negative={true} style={{textAlign: 'center'}}>
        Since you reset your account, participants have to accept to let you back in.
      </Text>
    </Box>
  </Box>
)

export default YouAreReset
