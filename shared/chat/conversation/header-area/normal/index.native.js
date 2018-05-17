// @flow
import * as React from 'react'
import {Avatar, BackButton, Box, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, collapseStyles} from '../../../../styles'

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
  <Box style={{position: 'relative', alignSelf: 'flex-start'}}>
    <Icon type="iconfont-shh" style={shhIconStyle} color={shhIconColor} fontSize={shhIconFontSize} />
  </Box>
)

const ChannelHeader = (props: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={props.badgeNumber}
      onClick={props.onBack}
      iconColor={globalColors.black_40}
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
          <Avatar teamname={props.teamName} size={props.smallTeam ? 16 : 12} />
          {!props.smallTeam && (
            <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
              &nbsp;{props.teamName}
            </Text>
          )}
          {props.smallTeam && (
            <Text type="BodyBig" style={{color: globalColors.black_75}}>
              &nbsp;{props.teamName}
            </Text>
          )}
          {props.smallTeam && props.muted && <ShhIcon />}
        </Box>
        {!props.smallTeam && (
          <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
            <Text type="BodyBig" style={{color: globalColors.black_75}}>
              #{props.channelName}
            </Text>
            {props.muted && <ShhIcon />}
          </Box>
        )}
      </Box>
    </Box>
    <Icon
      type="iconfont-info"
      style={collapseStyles([styleLeft, {flexShrink: 0, padding: globalMargins.tiny}])}
      fontSize={21}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = (props: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={props.badgeNumber}
      onClick={props.onBack}
      iconColor={globalColors.black_40}
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
        usernames={props.participants}
        containerStyle={styleCenter}
        onUsernameClicked={props.onShowProfile}
        skipSelf={true}
      />
      {props.muted && <ShhIcon />}
    </Box>
    {props.canOpenInfoPanel && (
      <Icon
        type="iconfont-info"
        style={collapseStyles([styleLeft, {flexShrink: 0, padding: globalMargins.tiny}])}
        fontSize={21}
        onClick={props.onToggleInfoPanel}
      />
    )}
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.fastBlank,
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
  marginLeft: globalMargins.xtiny,
}

const shhIconColor = globalColors.black_20

const shhIconFontSize = 20

export {ChannelHeader, UsernameHeader}
