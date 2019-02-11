// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as Styles from '../styles'
import * as Flow from '../util/flow'
import Assertion from './assertion/remote-container'
import Bio from './bio/remote-container'

type Props = {|
  assertionKeys: ?$ReadOnlyArray<string>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: ?string,
  isYou: boolean,
  location: ?string,
  onFollow: () => void,
  onChat: () => void,
  onClose: () => void,
  onIgnoreFor24Hours: () => void,
  onAccept: () => void,
  onReload: () => void,
  reason: string,
  state: Types.DetailsState,
  teamShowcase: ?$ReadOnlyArray<Types._TeamShowcase>,
  username: string,
|}

const getButtons = (props: Props) => {
  const buttonClose = (
    <Kb.WaitingButton
      type="Secondary"
      key="Close"
      label="Close"
      waitingKey={Constants.waitingKey}
      onClick={props.onClose}
    />
  )
  const buttonAccept = (
    <Kb.WaitingButton
      type="PrimaryGreen"
      key="Accept"
      label="Accept"
      waitingKey={Constants.waitingKey}
      onClick={props.onAccept}
    />
  )
  const buttonChat = (
    <Kb.WaitingButton
      type="Primary"
      key="Chat"
      label="Chat"
      waitingKey={Constants.waitingKey}
      onClick={props.onChat}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.white} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  if (props.isYou) {
    return [buttonClose, buttonChat]
  }

  switch (props.state) {
    case 'checking':
      break
    case 'valid':
      return props.followThem
        ? [buttonClose, buttonChat]
        : [
            buttonChat,
            <Kb.WaitingButton
              type="PrimaryGreen"
              key="Follow"
              label="Follow"
              waitingKey={Constants.waitingKey}
              onClick={props.onFollow}
            />,
          ]
    case 'broken':
      return [
        <Kb.WaitingButton
          type="Secondary"
          key="Ignore for 24 hours"
          label="Ignore for 24 hours"
          waitingKey={Constants.waitingKey}
          onClick={props.onIgnoreFor24Hours}
        />,
        buttonAccept,
      ]
    case 'needsUpgrade':
      return [buttonChat, buttonAccept]
    case 'error':
      return [
        <Kb.WaitingButton
          type="Primary"
          key="Reload"
          label="Reload"
          waitingKey={Constants.waitingKey}
          onClick={props.onReload}
        />,
      ]
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.state)
  }
  return []
}

const TeamShowcase = ({name}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
    <Kb.Avatar size={32} teamname={name} isTeam={true} />
    <Kb.Text type="BodySemibold">{name}</Kb.Text>
  </Kb.Box2>
)

const Tracker = (props: Props) => {
  let assertions
  if (props.assertionKeys) {
    const unsorted = [...props.assertionKeys]
    const sorted = unsorted.sort(Constants.sortAssertionKeys)
    assertions = sorted.map(a => <Assertion key={a} assertionKey={a} />)
  } else {
    // TODO could do a loading thing before we know about the list at all?
    assertions = null
  }

  let backgroundColor
  if (['broken', 'error'].includes(props.state)) {
    backgroundColor = Styles.globalColors.red
  } else {
    backgroundColor = props.followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }

  const buttons = getButtons(props)

  // In order to keep the 'effect' of the card sliding up on top of the text the text is below the scroll area. We still need the spacing so we draw the text inside the scroll but invisible

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
        <Kb.Icon type="iconfont-close" onClick={props.onClose} style={styles.close} />
      </Kb.Box2>
      <Kb.Text type="BodySmallSemibold" style={Styles.collapseStyles([styles.reason, {backgroundColor}])}>
        {props.reason}
      </Kb.Text>
      <Kb.ScrollView style={styles.scrollView}>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmallSemibold" style={styles.reasonInvisible}>
            {props.reason}
          </Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.avatarContainer}>
            <Kb.Box2 direction="vertical" style={styles.avatarBackground} />
            <Kb.Box2 direction="vertical" style={styles.nameWithIconContainer}>
              <Kb.ConnectedNameWithIcon
                onClick="profile"
                username={props.username}
                colorFollowing={true}
                notFollowingColorOverride={Styles.globalColors.orange}
              />
            </Kb.Box2>
          </Kb.Box2>
          <Bio username={props.username} />
          {props.teamShowcase && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamShowcases} gap="xtiny">
              {props.teamShowcase.map(t => (
                <TeamShowcase key={t.name} {...t} />
              ))}
            </Kb.Box2>
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.assertions}>
            {assertions}
          </Kb.Box2>
          {!!buttons.length && (
            <Kb.Box2 fullWidth={true} direction="vertical" style={styles.spaceUnderButtons} />
          )}
        </Kb.Box2>
      </Kb.ScrollView>
      {!!buttons.length && (
        <Kb.Box2 gap="small" centerChildren={true} direction="horizontal" style={styles.buttons}>
          {buttons}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const avatarSize = 96
const barHeight = 62
const reason = {
  alignSelf: 'center',
  color: Styles.globalColors.white,
  flexShrink: 0,
  paddingBottom: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
  paddingTop: Styles.globalMargins.small,
  textAlign: 'center',
}

const styles = Styles.styleSheetCreate({
  assertions: {
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  avatarBackground: {
    backgroundColor: Styles.globalColors.white,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: avatarSize / 2,
  },
  avatarContainer: {flexShrink: 0, position: 'relative'},
  buttons: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fillAbsolute,
      backgroundColor: Styles.globalColors.white_90,
      flexShrink: 0,
      height: barHeight,
      position: 'absolute',
      top: undefined,
    },
    isElectron: {boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 3px'},
  }),
  chatIcon: {marginRight: Styles.globalMargins.tiny},
  close: {padding: Styles.globalMargins.tiny},
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDragging,
      backgroundColor: Styles.globalColors.white,
      position: 'relative',
    },
  }),
  header: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    position: 'absolute',
    zIndex: 9,
  },
  nameWithIconContainer: {alignSelf: 'center'},
  reason: {
    ...reason,
    ...Styles.globalStyles.fillAbsolute,
    bottom: undefined,
    paddingBottom: reason.paddingBottom + avatarSize / 2,
  },
  reasonInvisible: {
    ...reason,
    opacity: 0,
  },
  scrollView: {...Styles.globalStyles.fillAbsolute, paddingBottom: Styles.globalMargins.small},
  spaceUnderButtons: {
    flexShrink: 0,
    height: barHeight,
  },
  teamShowcases: {
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
})

export default Tracker
