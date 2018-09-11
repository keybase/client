// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

const YouAreReset = () => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
      <Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      <Icon type="icon-access-denied-266" />
    </Box>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: globalColors.red,
        padding: globalMargins.small,
      }}
    >
      <Text type="BodySemibold" backgroundMode="Terminal" style={{textAlign: 'center'}}>
        Since you reset your account, participants have to accept to let you back in.
      </Text>
    </Box>
  </Box>
)

export default YouAreReset
