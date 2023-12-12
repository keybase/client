import * as C from '@/constants'
import * as React from 'react'
import * as Constants from '@/constants/tracker2'
import * as Kb from '@/common-adapters'
import Assertion from './assertion/container'
import Bio from './bio/container'
import type * as T from '@/constants/types'

type Props = {
  assertionKeys?: ReadonlyArray<string>
  bio?: string
  darkMode: boolean
  followThem?: boolean
  followersCount?: number
  followingCount?: number
  followsYou?: boolean
  guiID?: string
  isYou: boolean
  location?: string
  onFollow: () => void
  onChat: () => void
  onClose: () => void
  onIgnoreFor24Hours: () => void
  onAccept: () => void
  onReload: () => void
  reason: string
  state: T.Tracker.DetailsState
  teamShowcase?: ReadonlyArray<T.Tracker.TeamShowcase>
  trackerUsername: string
}

const getButtons = (props: Props) => {
  const buttonClose = (
    <Kb.WaitingButton
      type="Dim"
      key="Close"
      label="Close"
      waitingKey={Constants.waitingKey}
      onClick={props.onClose}
    />
  )
  const buttonAccept = (
    <Kb.WaitingButton
      type="Success"
      key="Accept"
      label="Accept"
      waitingKey={Constants.waitingKey}
      onClick={props.onAccept}
    />
  )
  const buttonChat = (
    <Kb.WaitingButton key="Chat" label="Chat" waitingKey={Constants.waitingKey} onClick={props.onChat}>
      <Kb.Icon type="iconfont-chat" color={Kb.Styles.globalColors.whiteOrWhite} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  if (props.isYou) {
    return [buttonClose, buttonChat]
  }

  switch (props.state) {
    case 'notAUserYet':
      return [buttonClose]
    case 'checking':
      break
    case 'valid':
      return props.followThem
        ? [buttonClose, buttonChat]
        : [
            buttonChat,
            <Kb.WaitingButton
              type="Success"
              key="Follow"
              label="Follow"
              waitingKey={Constants.waitingKey}
              onClick={props.onFollow}
            />,
          ]
    case 'broken':
      return [
        <Kb.WaitingButton
          type="Dim"
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
          key="Reload"
          label="Reload"
          waitingKey={Constants.waitingKey}
          onClick={props.onReload}
        />,
      ]
    default:
      break
  }
  return []
}

const TeamShowcase = ({name}: {name: string}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
    <Kb.Avatar size={32} teamname={name} isTeam={true} />
    <Kb.Text type="BodySemibold">{name}</Kb.Text>
  </Kb.Box2>
)

const Tracker = (props: Props) => {
  const [lastDM, setLastDM] = React.useState(props.darkMode)
  if (props.darkMode !== lastDM) {
    setLastDM(props.darkMode)
    C.useDarkModeState
      .getState()
      .dispatch.setDarkModePreference(props.darkMode ? 'alwaysDark' : 'alwaysLight')
  }

  let assertions: React.ReactNode
  if (props.assertionKeys) {
    const unsorted = [...props.assertionKeys]
    const sorted = unsorted.sort(Constants.sortAssertionKeys)
    assertions = sorted.map(a => <Assertion username={props.trackerUsername} key={a} assertionKey={a} />)
  } else {
    // TODO could do a loading thing before we know about the list at all?
    assertions = null
  }

  let backgroundColor: string
  if (['broken', 'error'].includes(props.state)) {
    backgroundColor = Kb.Styles.globalColors.red
  } else {
    backgroundColor = props.followThem ? Kb.Styles.globalColors.green : Kb.Styles.globalColors.blue
  }

  const buttons = getButtons(props)

  // In order to keep the 'effect' of the card sliding up on top of the text the text is below the scroll area. We still need the spacing so we draw the text inside the scroll but invisible

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      style={styles.container}
      className={props.darkMode ? 'darkMode' : 'lightMode'}
      key={props.darkMode ? 'darkMode' : 'light'}
    >
      <Kb.Text type="BodySmallSemibold" style={Kb.Styles.collapseStyles([styles.reason, {backgroundColor}])}>
        {props.reason}
      </Kb.Text>
      {/* The header box must go after the reason text, so that the
       * close button's draggingClickable style goes on top of the
       * reason's draggable style, which matters on Linux. */}
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
        <Kb.Icon type="iconfont-close" onClick={props.onClose} style={styles.close} />
      </Kb.Box2>
      <Kb.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmallSemibold" style={styles.reasonInvisible}>
            {props.reason}
          </Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.avatarContainer}>
            <Kb.Box2 direction="vertical" style={styles.avatarBackground} />
            <Kb.Box2 direction="vertical" style={styles.nameWithIconContainer}>
              <Kb.ConnectedNameWithIcon
                size="big"
                onClick="profile"
                username={props.trackerUsername}
                underline={false}
                selectable={true}
                colorFollowing={true}
                notFollowingColorOverride={Kb.Styles.globalColors.orange}
              />
            </Kb.Box2>
          </Kb.Box2>
          <Bio inTracker={true} username={props.trackerUsername} />
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
  alignSelf: 'center' as const,
  color: Kb.Styles.globalColors.white,
  flexShrink: 0,
  paddingBottom: Kb.Styles.globalMargins.small,
  paddingLeft: Kb.Styles.globalMargins.medium,
  paddingRight: Kb.Styles.globalMargins.medium,
  paddingTop: Kb.Styles.globalMargins.small,
  textAlign: 'center' as const,
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      assertions: {
        backgroundColor: Kb.Styles.globalColors.white,
        flexShrink: 0,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.small,
      },
      avatarBackground: {
        backgroundColor: Kb.Styles.globalColors.white,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: avatarSize / 2,
      },
      avatarContainer: {flexShrink: 0, position: 'relative'},
      buttons: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          backgroundColor: Kb.Styles.globalColors.white_90,
          flexShrink: 0,
          height: barHeight,
          position: 'absolute',
          top: undefined,
        },
        isElectron: {boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 3px'},
      }),
      chatIcon: {marginRight: Kb.Styles.globalMargins.tiny},
      close: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.tiny},
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      container: {
        backgroundColor: Kb.Styles.globalColors.white,
        position: 'relative',
      },
      header: {
        justifyContent: 'flex-end',
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        zIndex: 9,
      },
      nameWithIconContainer: {alignSelf: 'center'},
      reason: Kb.Styles.platformStyles({
        common: {
          ...reason,
          ...Kb.Styles.globalStyles.fillAbsolute,
          bottom: undefined,
          paddingBottom: reason.paddingBottom + avatarSize / 2,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDragging,
        },
      }),
      reasonInvisible: {
        ...reason,
        opacity: 0,
      },
      scrollView: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: Kb.Styles.globalMargins.small,
        },
      }),
      spaceUnderButtons: {
        flexShrink: 0,
        height: barHeight,
      },
      teamShowcases: {
        backgroundColor: Kb.Styles.globalColors.white,
        flexShrink: 0,
        paddingLeft: Kb.Styles.globalMargins.medium,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default Tracker
