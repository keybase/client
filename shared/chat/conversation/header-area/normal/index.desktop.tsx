import * as React from 'react'
import {Box, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {Props} from './index.types'

const ShhIcon = props => (
  <Box style={{alignSelf: 'flex-start', height: 0, position: 'relative', width: 0}}>
    <Icon
      type="iconfont-shh"
      style={shhIconStyle}
      color={shhIconColor}
      fontSize={shhIconFontSize}
      onClick={props.onClick}
    />
  </Box>
)

const ChannelHeader = (props: Props) => (
  <Box style={containerStyle}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        marginLeft: 24,
      }}
    >
      <Text
        type={props.smallTeam ? 'BodyBig' : 'BodySmallSemibold'}
        style={props.smallTeam ? {color: globalColors.black} : {color: globalColors.black_50}}
      >
        {props.teamName}
      </Text>
      {!props.smallTeam && (
        <Text type="BodyBig" style={{color: globalColors.black, marginLeft: 2}}>
          #{props.channelName}
        </Text>
      )}
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box>
    {props.onToggleThreadSearch && <Icon type="iconfont-search" onClick={props.onToggleThreadSearch} />}
    {props.onOpenFolder && (
      <Icon type="iconfont-folder-private" style={styleLeft} onClick={props.onOpenFolder} />
    )}
    <Icon
      type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styleLeft}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = (props: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <ConnectedUsernames
        colorFollowing={true}
        underline={true}
        inline={false}
        commaColor={globalColors.black_50}
        type="BodyBig"
        usernames={props.participants}
        containerStyle={styleCenter}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1 /* length ===1 means just you so show yourself */}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box>
    {props.onToggleThreadSearch && (
      <Icon type="iconfont-search" style={styleLeft} onClick={props.onToggleThreadSearch} />
    )}
    {props.onOpenFolder && (
      <Icon type="iconfont-folder-private" style={styleLeft} onClick={props.onOpenFolder} />
    )}
    <Icon
      type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styleLeft}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

// TODO: is there a desktop design for this
export const PhoneOrEmailHeader = UsernameHeader

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_10,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  justifyContent: 'center',
  minHeight: 32,
  padding: globalMargins.tiny,
}

const styleCenter = {
  justifyContent: 'center',
  textAlign: 'center',
} as const

const styleLeft = {
  marginLeft: globalMargins.tiny,
}

const shhIconStyle = {
  marginLeft: globalMargins.xtiny,
}

const shhIconColor = globalColors.black_20

const shhIconFontSize = 20

export {ChannelHeader, UsernameHeader}
