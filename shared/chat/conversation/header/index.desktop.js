// @flow
import * as React from 'react'
import {Box, Icon, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {Props} from '.'

const ChannelHeader = ({channelName, infoPanelOpen, muted, onToggleInfoPanel, teamName}: Props) => (
  <Box style={containerStyle}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 48,
      }}
    >
      <Text type="BodyBig" style={{color: globalColors.black_40}}>{teamName}</Text>
      <Text type="Header" style={{color: globalColors.black_75}}>&nbsp;#{channelName}</Text>
      {muted && <Icon type="iconfont-shh" style={styleLeft} />}
    </Box>
    <Icon
      type={infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styleLeft}
      onClick={onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = ({
  infoPanelOpen,
  muted,
  onOpenFolder,
  onShowProfile,
  onToggleInfoPanel,
  users,
}: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <Usernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type="BodyBig"
        users={users}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile}
      />
      {muted && <Icon type="iconfont-shh" style={styleLeft} />}
    </Box>
    <Icon type="iconfont-folder-private" style={styleLeft} onClick={onOpenFolder} />
    <Icon
      type={infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styleLeft}
      onClick={onToggleInfoPanel}
    />
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

export {ChannelHeader, UsernameHeader}
