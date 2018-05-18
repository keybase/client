// @flow
import * as React from 'react'
import {
  Avatar,
  BackButton,
  Box,
  Icon,
  Text,
  ConnectedUsernames,
  iconCastPlatformStyles,
} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, collapseStyles, styleSheetCreate} from '../../../../styles'

import type {Props} from '.'

const ShhIcon = () => (
  <Box style={{position: 'relative', alignSelf: 'flex-start'}}>
    <Icon
      type="iconfont-shh"
      style={iconCastPlatformStyles(styles.left)}
      color={shhIconColor}
      fontSize={shhIconFontSize}
    />
  </Box>
)

const ChannelHeader = (props: Props) => (
  <Box style={styles.container}>
    <BackButton
      badgeNumber={props.badgeNumber}
      onClick={props.onBack}
      iconColor={globalColors.black_40}
      textStyle={{color: globalColors.blue}}
      style={styles.backButton}
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
      style={collapseStyles([styles.left, styles.right, {flexShrink: 0, padding: globalMargins.tiny}])}
      fontSize={21}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = (props: Props) => (
  <Box style={styles.container}>
    <BackButton
      badgeNumber={props.badgeNumber}
      onClick={props.onBack}
      iconColor={globalColors.black_40}
      textStyle={{color: globalColors.blue}}
      style={styles.backButton}
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
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={true}
      />
      {props.muted && <ShhIcon />}
    </Box>
    {props.canOpenInfoPanel && (
      <Icon
        type="iconfont-info"
        style={collapseStyles([styles.left, styles.right, {flexShrink: 0, padding: globalMargins.tiny}])}
        fontSize={21}
        onClick={props.onToggleInfoPanel}
      />
    )}
  </Box>
)

const styles = styleSheetCreate({
  backButton: {
    flexShrink: 0,
    marginLeft: globalMargins.small - 4,
    padding: globalMargins.tiny,
    paddingLeft: 0,
  },
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: globalColors.fastBlank,
    borderBottomColor: globalColors.black_05,
    borderBottomWidth: 1,
    justifyContent: 'flex-start',
    minHeight: 32,
  },
  left: {
    marginLeft: globalMargins.xtiny,
  },
  right: {
    marginRight: globalMargins.tiny,
  },
})
const shhIconColor = globalColors.black_20
const shhIconFontSize = 20

export {ChannelHeader, UsernameHeader}
