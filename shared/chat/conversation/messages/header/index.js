// @flow
import * as React from 'react'
import {Text, Box, Icon} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
import CreateTeamNotice from '../../notices/create-team-notice/container'

import type {Props} from '.'

const MessageLoadingMore = ({moreToLoad, showTeamOffer}: Props) => (
  <Box>
    <Box style={secureStyle}>
      {!moreToLoad && <Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />}
    </Box>
    <Box style={moreStyle}>
      {showTeamOffer && <CreateTeamNotice />}
    </Box>
    <Box style={moreToLoad ? moreStyle : noneStyle}>
      <Text type="BodySmallSemibold">ヽ(ಠ益ಠ)ノ</Text>
      <Text type="BodySmallSemibold">Digging ancient messages...</Text>
    </Box>
  </Box>
)

const secureStyle = {
  ...globalStyles.flexBoxCenter,
  height: 116,
}

const moreStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const noneStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  opacity: 0,
}

export default MessageLoadingMore
