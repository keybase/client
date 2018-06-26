// @flow
import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Box2,
  ClickableBox,
  Icon,
  Text,
  ConnectedUsernames,
  iconCastPlatformStyles,
} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, collapseStyles, styleSheetCreate} from '../../../../styles'

import type {Props} from '.'

const ShhIcon = () => (
  <Icon
    type="iconfont-shh"
    style={iconCastPlatformStyles(styles.left)}
    color={shhIconColor}
    fontSize={shhIconFontSize}
  />
)

const Back = (props: {badgeNumber: number, onBack: () => void}) => (
  <ClickableBox onClick={props.onBack} style={styles.buttonContainer}>
    <Box2 direction="horizontal" style={collapseStyles([styles.button, styles.backButton])}>
      <Icon type="iconfont-arrow-left" fontSize={22} color={globalColors.blue} />
      {props.badgeNumber && (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={{marginLeft: -3, marginTop: -3}} />
      )}
    </Box2>
  </ClickableBox>
)

const Wrapper = (props: {
  badgeNumber: number,
  children: React.Node,
  onBack: () => void,
  onToggleInfoPanel: () => void,
}) => (
  <Box2
    direction="horizontal"
    style={{
      alignItems: 'stretch',
      backgroundColor: globalColors.fastBlank,
      borderBottomColor: globalColors.black_05,
      borderBottomWidth: 1,
      minHeight: 32,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    }}
  >
    <ClickableBox
      onClick={props.onBack}
      style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'flex-start', width: 50}}
    >
      <Icon type="iconfont-arrow-left" fontSize={24} color={globalColors.blue} />
      {!!props.badgeNumber && (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={{marginLeft: -5, marginTop: -3}} />
      )}
    </ClickableBox>
    <Box2
      direction="vertical"
      style={{
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingBottom: globalMargins.tiny,
        paddingTop: globalMargins.tiny,
      }}
    >
      {props.children}
    </Box2>
    <ClickableBox
      onClick={props.onToggleInfoPanel}
      style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'flex-end', width: 50}}
    >
      <Icon type="iconfont-info" fontSize={24} />
    </ClickableBox>
  </Box2>
)

// const Wrapper = (props: {
//   badgeNumber: number,
//   children: React.Node,
//   onBack: () => void,
//   onToggleInfoPanel: () => void,
// }) => (
//   <Box2 direction="horizontal" style={styles.container}>
//     <Back badgeNumber={props.badgeNumber} onBack={props.onBack} />
//     <Box2
//       direction="vertical"
//       style={{
//         alignItems: 'center',
//         flex: 1,
//         justifyContent: 'center',
//         paddingTop: globalMargins.tiny,
//         paddingBottom: globalMargins.tiny,
//       }}
//     >
//       {props.children}
//     </Box2>
//     <ClickableBox onClick={props.onToggleInfoPanel} style={styles.buttonContainer}>
//       <Box2 direction="horizontal" style={collapseStyles([styles.button, styles.infoButton])}>
//         <Icon type="iconfont-info" fontSize={21} />
//       </Box2>
//     </ClickableBox>
//   </Box2>
// )

const ChannelHeader = (props: Props) => (
  <Wrapper {...props}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', alignSelf: 'center'}}>
      <Avatar teamname={props.teamName} size={16} />
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
  </Wrapper>
)

const UsernameHeader = (props: Props) => (
  <Wrapper {...props}>
    <ConnectedUsernames
      colorFollowing={true}
      inline={false}
      commaColor={globalColors.black_40}
      type="BodyBig"
      usernames={props.participants}
      containerStyle={styles.center}
      onUsernameClicked={props.onShowProfile}
      skipSelf={props.participants.length > 1}
    />
    {props.muted && <ShhIcon />}
  </Wrapper>
)

const styles = styleSheetCreate({
  backButton: {
    justifyContent: 'flex-start',
    marginLeft: globalMargins.small,
    marginRight: globalMargins.xtiny,
  },
  button: {
    alignItems: 'center',
    width: 30,
  },
  buttonContainer: {
    ...globalStyles.flexBoxRow,
    alignSelf: 'stretch',
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
  infoButton: {
    justifyContent: 'flex-end',
    marginLeft: globalMargins.xtiny,
    marginRight: globalMargins.small,
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
