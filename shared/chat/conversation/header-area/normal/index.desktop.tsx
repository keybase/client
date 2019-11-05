import * as React from 'react'
import {Box, Icon, Text, ConnectedUsernames} from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {Props} from '.'

const ShhIcon = props => (
  <Box style={{alignSelf: 'flex-start', height: 0, position: 'relative', width: 0}}>
    <Icon type="iconfont-shh" style={styles.shh} color="black_20" fontSize={20} onClick={props.onClick} />
  </Box>
)

const ChannelHeader = (props: Props) => (
  <Box style={styles.container}>
    <Box
      style={
        {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          marginLeft: 24,
        } as const
      }
    >
      <Text
        type={props.smallTeam ? 'BodyBig' : 'BodySmallSemibold'}
        style={props.smallTeam ? {color: Styles.globalColors.black} : {color: Styles.globalColors.black_50}}
      >
        {props.teamName}
      </Text>
      {!props.smallTeam && (
        <Text type="BodyBig" style={{color: Styles.globalColors.black, marginLeft: 2}}>
          #{props.channelName}
        </Text>
      )}
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box>
    {props.onToggleThreadSearch && <Icon type="iconfont-search" onClick={props.onToggleThreadSearch} />}
    {props.onOpenFolder && (
      <Icon type="iconfont-folder-private" style={styles.left} onClick={props.onOpenFolder} />
    )}
    <Icon
      type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styles.left}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

const UsernameHeader = (props: Props) => (
  <Box style={styles.container}>
    <Box style={{...Styles.globalStyles.flexBoxRow, flex: 1, justifyContent: 'center', marginLeft: 48}}>
      <ConnectedUsernames
        colorFollowing={true}
        underline={true}
        inline={false}
        commaColor={Styles.globalColors.black_50}
        type="BodyBig"
        usernames={props.participants}
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1 /* length ===1 means just you so show yourself */}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box>
    {props.onToggleThreadSearch && (
      <Icon type="iconfont-search" style={styles.left} onClick={props.onToggleThreadSearch} />
    )}
    {props.onOpenFolder && (
      <Icon type="iconfont-folder-private" style={styles.left} onClick={props.onOpenFolder} />
    )}
    <Icon
      type={props.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
      style={styles.left}
      onClick={props.onToggleInfoPanel}
    />
  </Box>
)

// TODO: is there a desktop design for this
export const PhoneOrEmailHeader = UsernameHeader
const styles = Styles.styleSheetCreate(
  () =>
    ({
      center: {justifyContent: 'center', textAlign: 'center'},
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        justifyContent: 'center',
        minHeight: 32,
        padding: Styles.globalMargins.tiny,
      },
      left: {marginLeft: Styles.globalMargins.tiny},
      shh: {marginLeft: Styles.globalMargins.xtiny},
    } as const)
)

export {ChannelHeader, UsernameHeader}
