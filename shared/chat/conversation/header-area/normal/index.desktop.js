// @flow
import * as React from 'react'
import {Box, Box2, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import type {Props} from './index.types'

const ShhIcon = props => (
  <Box style={{height: 0, position: 'relative', width: 0, alignSelf: 'flex-start'}}>
    <Icon
      type="iconfont-shh"
      style={shhIconStyle}
      color={shhIconColor}
      fontSize={shhIconFontSize}
      onClick={props.onClick}
    />
  </Box>
)

type DescriptionProps = {
  description: ?string,
}

class Description extends React.Component<Props> {
  render() {
    return (
      <Box2 direction="horizontal" style={{alignSelf: 'center'}}>
        <Text type="BodyTiny">{this.props.description}</Text>
      </Box2>
    )
  }
}

const ChannelHeader = (props: Props) => (
  <Box2 direction="horizontal" fullWidth={true} style={containerStyle}>
    <Box2 direction="horizontal" />
    <Box2 direction="vertical" fullWidth={true}>
      <Box2
        direction="horizontal"
        style={{
          alignItems: 'center',
        }}
      >
        <Text
          type={props.smallTeam ? 'BodyBig' : 'BodySmallSemibold'}
          style={props.smallTeam ? {color: globalColors.black_75} : {color: globalColors.black_40}}
        >
          {props.teamName}
        </Text>
        {!props.smallTeam && (
          <Text type="BodyBig" style={{color: globalColors.black_75, marginLeft: 2}}>
            #{props.channelName}
          </Text>
        )}
        {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
      </Box2>
      <Description description={props.description} />
    </Box2>
    <Box2 direction="horizontal">
      {props.onOpenFolder && (
        <Icon type="iconfont-folder-private" style={styleLeft} onClick={props.onOpenFolder} />
      )}
      <Icon
        type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
        style={styleLeft}
        onClick={props.onToggleInfoPanel}
      />
    </Box2>
  </Box2>
)

const UsernameHeader = (props: Props) => (
  <Box style={containerStyle}>
    <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <ConnectedUsernames
        colorFollowing={true}
        underline={true}
        inline={false}
        commaColor={globalColors.black_40}
        type="BodyBig"
        usernames={props.participants}
        containerStyle={styleCenter}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1 /* length ===1 means just you so show yourself */}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box>
    {props.onOpenFolder && (
      <Icon type="iconfont-folder-private" style={styleLeft} onClick={props.onOpenFolder} />
    )}
    {props.canOpenInfoPanel && (
      <Icon
        type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
        style={styleLeft}
        onClick={props.onToggleInfoPanel}
      />
    )}
    {props.onCancelPending && <Icon type="iconfont-close" onClick={props.onCancelPending} />}
  </Box>
)

const containerStyle = {
  borderBottomColor: globalColors.black_10,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  minHeight: 32,
  padding: globalMargins.tiny,
  justifyContent: 'space-between',
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
