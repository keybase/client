// @flow
import * as React from 'react'
import {Avatar, BackButton, Box, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'

import type {Props} from '.'

const ShhIcon = () => (
  <Box style={{position: 'relative', alignSelf: 'flex-start'}}>
    <Icon type="iconfont-shh" style={shhIconStyle} />
  </Box>
)

const ChannelHeader = ({
  badgeNumber,
  channelName,
  muted,
  onBack,
  onToggleInfoPanel,
  teamName,
  smallTeam,
}: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={badgeNumber}
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
      }}
    >
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', alignSelf: 'center'}}>
          <Avatar teamname={teamName} size={smallTeam ? 16 : 12} />
          {!smallTeam && (
            <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
              &nbsp;{teamName}
            </Text>
          )}
          {smallTeam && (
            <Text type="BodyBig" style={{color: globalColors.black_75}}>
              &nbsp;{teamName}
            </Text>
          )}
          {smallTeam && muted && <ShhIcon />}
        </Box>
        {!smallTeam && (
          <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
            <Text type="BodyBig" style={{color: globalColors.black_75}}>
              #{channelName}
            </Text>
            {muted && <ShhIcon />}
          </Box>
        )}
      </Box>
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
  canOpenInfoPanel,
  muted,
  onBack,
  onOpenFolder,
  onShowProfile,
  onToggleInfoPanel,
  participants,
}: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={badgeNumber}
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
      <ConnectedUsernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type="BodyBig"
        usernames={participants}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile}
        skipSelf={true}
      />
      {muted && <ShhIcon />}
    </Box>
    {canOpenInfoPanel && (
      <Icon
        type="iconfont-info"
        style={{...styleLeft, flexShrink: 0, padding: globalMargins.tiny, fontSize: 21}}
        onClick={onToggleInfoPanel}
      />
    )}
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
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

const shhIconStyle = {
  ...styleLeft,
  color: globalColors.black_20,
  fontSize: 22,
}

export {ChannelHeader, UsernameHeader}
