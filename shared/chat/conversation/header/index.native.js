// @flow
import * as React from 'react'
import {Avatar, BackButton, Box, Icon, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {Props} from '.'

const ChannelHeader = ({badgeNumber, channelName, muted, onBack, onToggleInfoPanel, teamName}: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={badgeNumber}
      title={null}
      onClick={onBack}
      iconStyle={{color: globalColors.black_40}}
      textStyle={{color: globalColors.blue}}
      style={{flexShrink: 0, padding: globalMargins.tiny}}
    />
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        justifyContent: 'center',
        flex: 1,
        marginTop: 2,
        padding: globalMargins.tiny,
      }}
    >
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Avatar teamname={teamName} size={16} />
          <Text type="BodyBig" style={{color: globalColors.black_40}}>&nbsp;{teamName}</Text>
        </Box>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type="Header" style={{color: globalColors.black_75}}>#{channelName}</Text>
        </Box>
      </Box>

      {muted &&
        <Icon
          type="iconfont-shh"
          style={{...styleCenter, ...styleLeft, color: globalColors.black_20, fontSize: 22}}
        />}
    </Box>
    <Icon
      type="iconfont-info"
      style={{...styleLeft, flexShrink: 0, padding: globalMargins.tiny, fontSize: 21}}
      onClick={onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = ({
  badgeNumber,
  muted,
  onBack,
  onOpenFolder,
  onShowProfile,
  onToggleInfoPanel,
  users,
}: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={badgeNumber}
      title={null}
      onClick={onBack}
      iconStyle={{color: globalColors.black_40}}
      textStyle={{color: globalColors.blue}}
      style={{flexShrink: 0, padding: globalMargins.tiny}}
    />
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        justifyContent: 'center',
        flex: 1,
        marginTop: 2,
        padding: globalMargins.tiny,
      }}
    >
      <Usernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type="BodyBig"
        users={users}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile}
      />
      {muted &&
        <Icon
          type="iconfont-shh"
          style={{...styleCenter, ...styleLeft, color: globalColors.black_20, fontSize: 22}}
        />}
    </Box>
    <Icon
      type="iconfont-info"
      style={{...styleLeft, flexShrink: 0, padding: globalMargins.tiny, fontSize: 21}}
      onClick={onToggleInfoPanel}
    />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'flex-start',
  minHeight: 32,
}

const styleCenter = {
  justifyContent: 'center',
  textAlign: 'center',
}

const styleLeft = {
  marginLeft: globalMargins.xtiny,
}

export {ChannelHeader, UsernameHeader}
