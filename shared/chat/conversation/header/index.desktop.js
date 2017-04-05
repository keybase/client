// @flow
import React from 'react'
import {Box, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {Props} from '.'

const ConversationHeader = ({muted, onOpenFolder, onShowProfile, onToggleSidePanel, sidePanelOpen, users}: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <Usernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type='BodyBig'
        users={users}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile} />
      {muted && <Icon type='iconfont-shh' style={styleLeft} />}
    </Box>
    <Icon type='iconfont-folder-private' style={styleLeft} onClick={onOpenFolder} />
    <Icon type={sidePanelOpen ? 'iconfont-close' : 'iconfont-info'} style={styleLeft} onClick={onToggleSidePanel} />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottom: `solid 1px ${globalColors.black_05}`,
  justifyContent: 'center',
  minHeight: 32,
  padding: globalMargins.tiny,
}

const styleCenter = {
  justifyContent: 'center',
  textAlign: 'center',
}

const styleLeft = {
  marginLeft: globalMargins.tiny,
}

export default ConversationHeader
