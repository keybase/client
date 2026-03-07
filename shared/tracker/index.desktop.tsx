import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import openUrl from '@/util/open-url'
import {useColorScheme} from 'react-native'

export type Props = {
  assertions?: ReadonlyArray<T.Tracker.Assertion>
  bio?: string
  blocked: boolean
  darkMode: boolean
  followThem: boolean
  followersCount?: number
  followingCount?: number
  followsYou: boolean
  fullname?: string
  guiID: string
  hidFromFollowers: boolean
  httpSrvAddress: string
  httpSrvToken: string
  isYou: boolean
  location?: string
  onAccept: () => void
  onChat: () => void
  onClose: () => void
  onFollow: () => void
  onIgnoreFor24Hours: () => void
  onReload: () => void
  reason: string
  state: T.Tracker.DetailsState
  teamShowcase?: ReadonlyArray<T.Tracker.TeamShowcase>
  trackerUsername: string
}

const avatarUrl = (httpSrvAddress: string, httpSrvToken: string, username: string, darkMode: boolean) =>
  `http://${httpSrvAddress}/av?typ=user&name=${username}&format=square_192&mode=${darkMode ? 'dark' : 'light'}&token=${httpSrvToken}&count=0`

const teamAvatarUrl = (httpSrvAddress: string, httpSrvToken: string, teamname: string, darkMode: boolean) =>
  `http://${httpSrvAddress}/av?typ=team&name=${teamname}&format=square_192&mode=${darkMode ? 'dark' : 'light'}&token=${httpSrvToken}&count=0`

const getButtons = (props: Props) => {
  const buttonClose = (
    <Kb.Button type="Dim" key="Close" label="Close" onClick={props.onClose} />
  )
  const buttonAccept = (
    <Kb.Button type="Success" key="Accept" label="Accept" onClick={props.onAccept} />
  )
  const buttonChat = (
    <Kb.Button key="Chat" label="Chat" onClick={props.onChat}>
      <Kb.Icon2 type="iconfont-chat" color={Kb.Styles.globalColors.whiteOrWhite} style={styles.chatIcon} />
    </Kb.Button>
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
            <Kb.Button type="Success" key="Follow" label="Follow" onClick={props.onFollow} />,
          ]
    case 'broken':
      return [
        <Kb.Button type="Dim" key="Ignore for 24 hours" label="Ignore for 24 hours" onClick={props.onIgnoreFor24Hours} />,
        buttonAccept,
      ]
    case 'needsUpgrade':
      return [buttonChat, buttonAccept]
    case 'error':
      return [<Kb.Button key="Reload" label="Reload" onClick={props.onReload} />]
    default:
      break
  }
  return []
}

// Inline bio rendering (store-free)
const Bio = (props: {
  bio?: string
  blocked: boolean
  followThem: boolean
  followersCount?: number
  followingCount?: number
  followsYou: boolean
  fullname?: string
  hidFromFollowers: boolean
  location?: string
  trackerUsername: string
}) => {
  const {bio, blocked, followThem, followersCount, followingCount, followsYou, fullname, hidFromFollowers, location, trackerUsername} = props
  let followText = ''
  if (followThem) {
    followText = followsYou ? 'YOU FOLLOW EACH OTHER' : 'YOU FOLLOW THEM'
  } else if (followsYou) {
    followText = 'FOLLOWS YOU'
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bioContainer} centerChildren={true} gap="xtiny">
      <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
        <Kb.Text center={true} type="BodyBig" lineClamp={1} selectable={true}>
          {fullname}
        </Kb.Text>
      </Kb.Box2>
      {!!followText && <Kb.Text type="BodySmall">{followText}</Kb.Text>}
      {followersCount !== undefined && (
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall" style={styles.bold}>{followersCount}</Kb.Text>
          {' Followers · Following '}
          <Kb.Text type="BodySmall" style={styles.bold}>{followingCount}</Kb.Text>
        </Kb.Text>
      )}
      {!!bio && (
        <Kb.Text type="Body" center={true} lineClamp={2} style={styles.bioText} selectable={true}>
          {bio}
        </Kb.Text>
      )}
      {!!location && (
        <Kb.Text type="BodySmall" center={true} lineClamp={1} style={styles.bioText} selectable={true}>
          {location}
        </Kb.Text>
      )}
      {blocked ? (
        <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
          {"You blocked them. "}
          {trackerUsername}
          {" won't be able to chat with you or add you to teams."}
        </Kb.Text>
      ) : (
        hidFromFollowers && (
          <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
            You hid them from your followers.
          </Kb.Text>
        )
      )}
    </Kb.Box2>
  )
}

const _scoreAssertionKey = (a: string) => {
  switch (a) {
    case 'pgp': return 110
    case 'twitter': return 100
    case 'facebook': return 90
    case 'github': return 80
    case 'reddit': return 75
    case 'hackernews': return 70
    case 'https': return 60
    case 'http': return 50
    case 'dns': return 40
    case 'stellar': return 30
    case 'btc': return 20
    case 'zcash': return 10
    default: return 1
  }
}

const sortAssertions = (a: T.Tracker.Assertion, b: T.Tracker.Assertion) => {
  if (a.type === b.type) {
    return a.value.localeCompare(b.value)
  }
  return _scoreAssertionKey(b.type) - _scoreAssertionKey(a.type)
}

const assertionColorToColor = (c: T.Tracker.AssertionColor) => {
  switch (c) {
    case 'blue': return Kb.Styles.globalColors.blue
    case 'red': return Kb.Styles.globalColors.red
    case 'black': return Kb.Styles.globalColors.black
    case 'green': return Kb.Styles.globalColors.green
    case 'gray': return Kb.Styles.globalColors.black_50
    case 'yellow':
    case 'orange':
    default: return Kb.Styles.globalColors.red
  }
}

const assertionColorToTextColor = (c: T.Tracker.AssertionColor) => {
  switch (c) {
    case 'blue': return Kb.Styles.globalColors.blueDark
    case 'red': return Kb.Styles.globalColors.redDark
    case 'black': return Kb.Styles.globalColors.black
    case 'green': return Kb.Styles.globalColors.greenDark
    case 'gray': return Kb.Styles.globalColors.black_50
    case 'yellow':
    case 'orange':
    default: return Kb.Styles.globalColors.redDark
  }
}

const stateToIcon = (state: T.Tracker.AssertionState) => {
  switch (state) {
    case 'checking': return 'iconfont-proof-pending'
    case 'valid': return 'iconfont-proof-good'
    case 'error':
    case 'warning':
    case 'revoked': return 'iconfont-proof-broken'
    case 'suggestion': return 'iconfont-proof-placeholder'
    default: return 'iconfont-proof-pending'
  }
}

const siteIconToSrcSet = (set: T.Tracker.SiteIconSet) =>
  set.map(i => `url("${i.path}")`).reverse().join(', ')

// Inline assertion rendering (store-free)
const AssertionRow = (props: {assertion: T.Tracker.Assertion}) => {
  const {assertion: a} = props
  const isDarkMode = useColorScheme() === 'dark'
  const iconSet = isDarkMode ? a.siteIconDarkmode : a.siteIcon
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.assertionRow}>
      <Kb.Box2 alignItems="flex-start" direction="horizontal" gap="tiny" fullWidth={true} gapStart={true} gapEnd={true}>
        {iconSet.length > 0 && (
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([
              styles.siteIcon,
              Kb.Styles.platformStyles({isElectron: {backgroundImage: siteIconToSrcSet(iconSet)}}),
            ])}
          />
        )}
        <Kb.Text type="Body" style={styles.assertionTextContainer}>
          <Kb.Text
            type="BodyPrimaryLink"
            onClick={a.siteURL ? () => openUrl(a.siteURL) : undefined}
            style={Kb.Styles.collapseStyles([
              styles.assertionValue,
              a.state === 'revoked' && styles.strikeThrough,
              {color: assertionColorToTextColor(a.color)},
            ])}
          >
            {a.value}
          </Kb.Text>
          <Kb.Text type="Body" style={styles.assertionSite}>@{a.type}</Kb.Text>
        </Kb.Text>
        <Kb.Icon2
          type={stateToIcon(a.state)}
          fontSize={20}
          color={assertionColorToColor(a.color)}
          onClick={a.proofURL ? () => openUrl(a.proofURL) : undefined}
        />
      </Kb.Box2>
      {!!a.metas.length && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.metaContainer}>
          {a.metas.map(m => (
            <Kb.Meta key={m.label} backgroundColor={assertionColorToColor(m.color)} title={m.label} />
          ))}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const TeamShowcase = (props: {name: string; httpSrvAddress: string; httpSrvToken: string}) => {
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
      <img
        src={teamAvatarUrl(props.httpSrvAddress, props.httpSrvToken, props.name, isDarkMode)}
        width={32}
        height={32}
        style={styles.teamAvatar}
        loading="lazy"
      />
      <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
    </Kb.Box2>
  )
}

const Tracker = (props: Props) => {
  const isDarkMode = useColorScheme() === 'dark'

  const sortedAssertions = props.assertions ? [...props.assertions].sort(sortAssertions) : null

  let backgroundColor: string
  if (['broken', 'error'].includes(props.state)) {
    backgroundColor = Kb.Styles.globalColors.red
  } else {
    backgroundColor = props.followThem ? Kb.Styles.globalColors.green : Kb.Styles.globalColors.blue
  }

  const buttons = getButtons(props)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} relative={true} style={styles.container}>
      <Kb.Text type="BodySmallSemibold" style={Kb.Styles.collapseStyles([styles.reason, {backgroundColor}])}>
        {props.reason}
      </Kb.Text>
      {/* Close button must go after reason text for z-ordering on Linux */}
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header} justifyContent="flex-end">
        <Kb.Icon2 type="iconfont-close" color={Kb.Styles.globalColors.black_20} onClick={props.onClose} style={styles.close} />
      </Kb.Box2>
      <Kb.ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmallSemibold" style={styles.reasonInvisible}>
            {props.reason}
          </Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} relative={true} style={styles.avatarContainer}>
            <Kb.Box2 direction="vertical" style={styles.avatarBackground} />
            <Kb.Box2 direction="vertical" style={styles.nameWithIconContainer}>
              <Kb.Box2 direction="vertical" centerChildren={true} gap="tiny">
                <img
                  src={avatarUrl(props.httpSrvAddress, props.httpSrvToken, props.trackerUsername, isDarkMode)}
                  width={96}
                  height={96}
                  style={styles.avatar}
                  loading="lazy"
                />
                <Kb.Text type="BodyBig" selectable={true}>
                  {props.trackerUsername}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
          <Bio
            bio={props.bio}
            blocked={props.blocked}
            followThem={props.followThem}
            followersCount={props.followersCount}
            followingCount={props.followingCount}
            followsYou={props.followsYou}
            fullname={props.fullname}
            hidFromFollowers={props.hidFromFollowers}
            location={props.location}
            trackerUsername={props.trackerUsername}
          />
          {props.teamShowcase && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamShowcases} gap="xtiny">
              {props.teamShowcase.map(t => (
                <TeamShowcase key={t.name} name={t.name} httpSrvAddress={props.httpSrvAddress} httpSrvToken={props.httpSrvToken} />
              ))}
            </Kb.Box2>
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.assertions}>
            {sortedAssertions?.map(a => <AssertionRow key={a.assertionKey} assertion={a} />)}
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
      assertionRow: {flexShrink: 0, paddingBottom: 4, paddingTop: 4},
      assertionSite: {color: Kb.Styles.globalColors.black_20},
      assertionTextContainer: Kb.Styles.platformStyles({
        common: {flexGrow: 1, flexShrink: 1, marginTop: -1},
      }),
      assertionValue: Kb.Styles.platformStyles({
        common: {letterSpacing: 0.2},
        isElectron: {wordBreak: 'break-all'},
      }),
      assertions: {
        backgroundColor: Kb.Styles.globalColors.white,
        flexShrink: 0,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.small,
      },
      avatar: {borderRadius: '50%'} as const,
      avatarBackground: {
        backgroundColor: Kb.Styles.globalColors.white,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: avatarSize / 2,
      },
      avatarContainer: {flexShrink: 0},
      bioContainer: {backgroundColor: Kb.Styles.globalColors.white, flexShrink: 0},
      bioText: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.mediumLarge,
          paddingRight: Kb.Styles.globalMargins.mediumLarge,
        },
        isElectron: {wordBreak: 'break-word'} as const,
      }),
      blockedBackgroundText: {
        backgroundColor: Kb.Styles.globalColors.red_20,
        borderRadius: Kb.Styles.borderRadius,
        margin: Kb.Styles.globalMargins.small,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      bold: {...Kb.Styles.globalStyles.fontBold},
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
      },
      fullNameContainer: {
        paddingLeft: Kb.Styles.globalMargins.mediumLarge,
        paddingRight: Kb.Styles.globalMargins.mediumLarge,
      },
      header: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        zIndex: 9,
      },
      metaContainer: {flexShrink: 0, paddingLeft: 20 + Kb.Styles.globalMargins.tiny * 2 - 4},
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
      siteIcon: Kb.Styles.platformStyles({
        isElectron: {
          backgroundSize: 'contain',
          flexShrink: 0,
          height: 16,
          width: 16,
        },
      }),
      spaceUnderButtons: {
        flexShrink: 0,
        height: barHeight,
      },
      strikeThrough: {textDecorationLine: 'line-through'},
      teamAvatar: {borderRadius: Kb.Styles.borderRadius},
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
