// @flow
import * as React from 'react'
import {Box, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'

type Props = {|
  badgeNumber?: number,
  canOpenInfoPanel: boolean,
  channelName: ?string,
  muted: boolean,
  onBack: () => void,
  onOpenFolder: () => void,
  onShowProfile: (user: string) => void,
  onToggleInfoPanel: () => void,
  infoPanelOpen: boolean,
  teamName: ?string,
  participants: Array<string>,
  smallTeam: boolean,
|}

const ShhIcon = () => (
  <Box style={{height: 0, position: 'relative', width: 0, alignSelf: 'flex-start'}}>
    <Icon type="iconfont-shh" style={shhIconStyle} color={shhIconColor} fontSize={shhIconFontSize} />
  </Box>
)

const ChannelHeader = ({
  channelName,
  infoPanelOpen,
  muted,
  onOpenFolder,
  onToggleInfoPanel,
  teamName,
  smallTeam,
}: Props) => (
  <Box style={containerStyle}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 24,
      }}
    >
      <Text
        type={smallTeam ? 'BodyBig' : 'BodySmallSemibold'}
        style={smallTeam ? {color: globalColors.black_75} : {color: globalColors.black_40}}
      >
        {teamName}
      </Text>
      {!smallTeam && (
        <Text type="BodyBig" style={{color: globalColors.black_75, marginLeft: 2}}>
          #{channelName}
        </Text>
      )}
      {muted && <ShhIcon />}
    </Box>
    <Icon type="iconfont-folder-private" style={styleLeft} onClick={onOpenFolder} />
    <Icon
      type={infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styleLeft}
      onClick={onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = ({
  canOpenInfoPanel,
  infoPanelOpen,
  muted,
  onOpenFolder,
  onShowProfile,
  onToggleInfoPanel,
  participants,
}: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <ConnectedUsernames
        colorFollowing={true}
        underline={true}
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
    <Icon type="iconfont-folder-private" style={styleLeft} onClick={onOpenFolder} />
    {canOpenInfoPanel && (
      <Icon
        type={infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
        style={styleLeft}
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
  borderStyle: 'solid',
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

const shhIconStyle = {
  marginLeft: globalMargins.xtiny,
}

const shhIconColor = globalColors.black_20

const shhIconFontSize = 20

export {ChannelHeader, UsernameHeader}
