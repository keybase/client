import * as C from '@/constants'
import * as R from '@/constants/remote'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RemoteGen from '@/constants/remote-actions'
import * as FsUtil from '@/util/kbfs'
import * as TimestampUtil from '@/util/timestamp'
import Filename from '@/fs/common/filename'
import KB2 from '@/util/electron.desktop'
import OutOfDate from './out-of-date'
import Upload from '@/fs/footer/upload'
import {openURL as openUrl} from '@/util/misc'
import {Loading} from '@/fs/simple-screens'
import {isLinux, isDarwin} from '@/constants/platform'
import {type _InnerMenuItem} from '@/common-adapters/floating-menu/menu-layout'
import {useUploadCountdown} from '@/fs/footer/use-upload-countdown'
import {useColorScheme} from 'react-native'

const {hideWindow, ctlQuit} = KB2.functions

export type Conversation = {
  conversationIDKey: string
  teamType?: T.Chat.TeamType
  tlfname?: string
  teamname?: string
  timestamp?: number
  channelname?: string
  snippetDecorated?: string
  hasBadge?: true
  hasUnread?: true
  participants?: Array<string>
}

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: T.FS.Path
  updates: Array<{path: T.FS.Path; uploading: boolean}>
  writer: string
}

type KbfsDaemonStatus = {
  readonly rpcStatus: T.FS.KbfsDaemonRpcStatus
  readonly onlineStatus: T.FS.KbfsDaemonOnlineStatus
}

export type Props = {
  conversationsToSend: ReadonlyArray<Conversation>
  daemonHandshakeState: T.Config.DaemonHandshakeState
  diskSpaceStatus: T.FS.DiskSpaceStatus
  endEstimate?: number
  fileName?: string
  files: number
  following: ReadonlyArray<string>
  httpSrvAddress: string
  httpSrvToken: string
  kbfsDaemonStatus: KbfsDaemonStatus
  kbfsEnabled: boolean
  loggedIn: boolean
  navBadges: {[tab: string]: number}
  outOfDate: T.Config.OutOfDate
  remoteTlfUpdates: ReadonlyArray<RemoteTlfUpdates>
  showingDiskSpaceBanner: boolean
  totalSyncingBytes: number
  username: string
  windowShownCount: number
  darkMode: boolean
}

// Simple avatar via httpSrv
const HttpAvatar = (p: {
  name: string
  isTeam?: boolean
  size: number
  httpSrvAddress: string
  httpSrvToken: string
  style?: React.CSSProperties
}) => {
  const isDarkMode = useColorScheme() === 'dark'
  const typ = p.isTeam ? 'team' : 'user'
  const src = `http://${p.httpSrvAddress}/av?typ=${typ}&name=${p.name}&format=square_192&mode=${isDarkMode ? 'dark' : 'light'}&token=${p.httpSrvToken}&count=0`
  return <img src={src} width={p.size} height={p.size} style={{...avatarStyle, ...p.style}} loading="lazy" />
}
const avatarStyle = {borderRadius: '50%', flexShrink: 0} satisfies React.CSSProperties

const ArrowTick = () => {
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        styles.arrowTick,
        {borderBottomColor: isDarkMode ? '#2d2d2d' : Kb.Styles.globalColors.blueDark},
      ])}
    />
  )
}

type UWCDProps = {
  endEstimate?: number
  files: number
  fileName?: string
  totalSyncingBytes: number
  isOnline: boolean
  smallMode: boolean
}
const UploadWithCountdown = (p: UWCDProps) => {
  const {endEstimate, files, fileName, totalSyncingBytes, isOnline, smallMode} = p
  const np = useUploadCountdown({endEstimate, fileName, files, isOnline, smallMode, totalSyncingBytes})
  return <Upload {...np} />
}

// Inline chat row (replaces SmallTeam + ChatProvider)
const ChatRow = (p: {conv: Conversation; httpSrvAddress: string; httpSrvToken: string; username: string}) => {
  const {conv, httpSrvAddress, httpSrvToken, username} = p
  const isTeam = conv.teamType !== 'adhoc'
  const name = isTeam ? conv.tlfname || '' : conv.participants?.filter(u => u !== username).join(', ') || conv.tlfname || ''
  const avatarName = isTeam ? conv.tlfname || '' : conv.participants?.find(u => u !== username) || ''
  const timestamp = conv.timestamp ? TimestampUtil.formatTimeForConversationList(conv.timestamp) : ''

  return (
    <Kb.ClickableBox
      onClick={() => R.remoteDispatch(RemoteGen.createOpenChatFromWidget({conversationIDKey: conv.conversationIDKey}))}
      style={styles.chatRow}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny" style={styles.chatRowInner}>
        <HttpAvatar
          name={avatarName}
          isTeam={isTeam}
          size={48}
          httpSrvAddress={httpSrvAddress}
          httpSrvToken={httpSrvToken}
        />
        <Kb.Box2 direction="vertical" flex={1} overflow="hidden" style={styles.chatRowText}>
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" justifyContent="space-between">
            <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny" overflow="hidden" style={styles.chatRowNameLeft}>
              <Kb.Text type={conv.hasUnread ? 'BodyBold' : 'BodySemibold'} lineClamp={1} style={styles.chatRowName}>
                {isTeam && conv.channelname ? `${name}#${conv.channelname}` : name}
              </Kb.Text>
              {conv.hasBadge && <Kb.Box2 direction="vertical" style={styles.chatBadge} />}
            </Kb.Box2>
            {!!timestamp && (
              <Kb.Text
                type="BodyTiny"
                style={Kb.Styles.collapseStyles([
                  styles.chatTimestamp,
                  conv.hasUnread && Kb.Styles.globalStyles.fontBold,
                ])}
              >
                {timestamp}
              </Kb.Text>
            )}
          </Kb.Box2>
          {!!conv.snippetDecorated && (
            <Kb.Text
              type="BodySmall"
              lineClamp={1}
              style={Kb.Styles.collapseStyles([
                conv.hasUnread ? styles.chatSnippetUnread : styles.chatSnippet,
                conv.hasUnread && Kb.Styles.globalStyles.fontBold,
              ])}
            >
              {conv.snippetDecorated}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const ChatPreview = (p: {conversationsToSend: ReadonlyArray<Conversation>; convLimit?: number; httpSrvAddress: string; httpSrvToken: string; username: string}) => {
  const {conversationsToSend, convLimit, httpSrvAddress, httpSrvToken, username} = p
  const convs = conversationsToSend.slice(0, convLimit ?? conversationsToSend.length)

  const openInbox = () => {
    R.remoteDispatch(RemoteGen.createShowMain())
    R.remoteDispatch(RemoteGen.createSwitchTab({tab: C.Tabs.chatTab}))
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
      {convs.map(c => (
        <ChatRow key={c.conversationIDKey} conv={c} httpSrvAddress={httpSrvAddress} httpSrvToken={httpSrvToken} username={username} />
      ))}
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
        <Kb.Button label="Open inbox" onClick={openInbox} small={true} mode="Secondary" />
      </Kb.Box2>
    </Kb.Box2>
  )
}

// Inline file updates (replaces FilesContainer + files.desktop.tsx with store-connected components)
const FileUpdate = (p: {path: T.FS.Path; uploading: boolean; onClick: () => void}) => (
  <Kb.ClickableBox className="hover-underline-container" onClick={p.onClick} style={styles.fileFullWidth}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.fileUpdateRow} alignItems="flex-start">
      <Kb.ImageIcon type="icon-file-16" style={styles.fileIcon} />
      {p.uploading && (
        <Kb.Box2 direction="vertical" style={styles.fileIconBadgeBox}>
          <Kb.ImageIcon type="icon-addon-file-uploading" style={styles.fileIconBadge} />
        </Kb.Box2>
      )}
      <Filename type="Body" path={p.path} />
    </Kb.Box2>
  </Kb.ClickableBox>
)

const defaultNumFileOptionsShown = 3

const FileUpdates = (p: {updates: ReadonlyArray<{path: T.FS.Path; uploading: boolean}>}) => {
  const [isShowingAll, setIsShowingAll] = React.useState(false)
  const shown = isShowingAll ? p.updates : p.updates.slice(0, defaultNumFileOptionsShown)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {shown.map(u => (
        <FileUpdate
          key={T.FS.pathToString(u.path)}
          path={u.path}
          uploading={u.uploading}
          onClick={() => u.path && R.remoteDispatch(RemoteGen.createOpenFilesFromWidget({path: u.path}))}
        />
      ))}
      {p.updates.length > defaultNumFileOptionsShown && !isShowingAll && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.showMoreContainer}>
          <Kb.Button
            label={`+ ${p.updates.length - defaultNumFileOptionsShown} more`}
            onClick={() => setIsShowingAll(true)}
            small={true}
            type="Dim"
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const FilesPreview = (p: {remoteTlfUpdates: ReadonlyArray<RemoteTlfUpdates>; following: ReadonlyArray<string>; httpSrvAddress: string; httpSrvToken: string}) => {
  const {remoteTlfUpdates, following, httpSrvAddress, httpSrvToken} = p
  const followingSet = new Set(following)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfSectionHeaderContainer}>
        <Kb.Text type="BodySmallSemibold" style={styles.tlfSectionHeader}>
          Recent files
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {remoteTlfUpdates.map(update => {
          const tlf = T.FS.pathToString(update.tlf)
          const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
          const tlfType = T.FS.getPathVisibility(update.tlf) || T.FS.TlfType.Private
          return (
            <Kb.Box2 key={tlf + update.writer + update.timestamp} direction="horizontal" fullWidth={true} gap="tiny" style={styles.tlfRowContainer}>
              <HttpAvatar
                name={update.writer}
                size={32}
                httpSrvAddress={httpSrvAddress}
                httpSrvToken={httpSrvToken}
              />
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="space-between">
                  <Kb.Text
                    type="BodyBold"
                    style={followingSet.has(update.writer) ? styles.tlfWriterFollowing : styles.tlfWriterNotFollowing}
                    className="hover-underline"
                  >
                    {update.writer}
                  </Kb.Text>
                  <Kb.Text type="BodyTiny" style={styles.tlfTime}>
                    {TimestampUtil.formatTimeForConversationList(update.timestamp)}
                  </Kb.Text>
                </Kb.Box2>
                <Kb.Box2 direction="horizontal" fullWidth={true}>
                  <Kb.Text type="BodySmall" style={styles.tlfParticipants}>in&nbsp;</Kb.Text>
                  <Kb.Text
                    className="hover-underline"
                    type="BodySmall"
                    style={styles.tlfParticipants}
                    onClick={() => update.tlf && R.remoteDispatch(RemoteGen.createOpenFilesFromWidget({path: update.tlf}))}
                  >
                    {tlfType === T.FS.TlfType.Team
                      ? teamname
                      : tlfType === T.FS.TlfType.Public
                        ? (
                            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
                              {(participants || []).join(',')}
                              <Kb.Meta backgroundColor={Kb.Styles.globalColors.green} size="Small" title="PUBLIC" />
                            </Kb.Box2>
                          )
                        : (participants || []).join(',')}
                  </Kb.Text>
                </Kb.Box2>
                <FileUpdates updates={update.updates} />
              </Kb.Box2>
            </Kb.Box2>
          )
        })}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useMenuItems = (
  p: Props & {showBadges?: boolean; openApp: (tab?: C.Tabs.AppTab) => void}
): ReadonlyArray<_InnerMenuItem> => {
  const {showBadges, navBadges, daemonHandshakeState, username, kbfsEnabled, openApp} = p
  const startingUp = daemonHandshakeState !== 'done'

  const ret = (() => {
    const common = [
      {onClick: () => openUrl(`https://keybase.io/${username || ''}`), title: 'Keybase.io'},
      {
        onClick: () => {
          const version = __VERSION__
          openUrl(
            `https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(version)}`
          )
        },
        title: 'Report a bug',
      },
      {
        onClick: () => {
          openUrl('https://keybase.io/docs')
          hideWindow?.()
        },
        title: 'Help',
      },
      {
        onClick: () => {
          if (!__DEV__) {
            if (isLinux) {
              R.remoteDispatch(RemoteGen.createStop({exitCode: T.RPCGen.ExitCode.ok}))
            } else {
              R.remoteDispatch(RemoteGen.createDumpLogs({reason: 'quitting through menu'}))
            }
          }
          hideWindow?.()
          setTimeout(() => {
            ctlQuit?.()
          }, 2000)
        },
        title: 'Quit Keybase',
      },
    ]

    if (startingUp) {
      return common
    }

    const openAppItem = [{onClick: () => openApp(), title: 'Open main app'}, 'Divider'] as const

    if (showBadges) {
      return [
        {
          onClick: () => openApp(C.Tabs.gitTab),
          title: 'Git',
          view: <TabView title="Git" iconType="iconfont-nav-2-git" count={navBadges[C.Tabs.gitTab]} />,
        },
        {
          onClick: () => openApp(C.Tabs.devicesTab),
          title: 'Devices',
          view: <TabView title="Devices" iconType="iconfont-nav-2-devices" count={navBadges[C.Tabs.devicesTab]} />,
        },
        {
          onClick: () => openApp(C.Tabs.settingsTab),
          title: 'Settings',
          view: <TabView title="Settings" iconType="iconfont-nav-2-settings" count={navBadges[C.Tabs.settingsTab]} />,
        },
        'Divider' as const,
        ...openAppItem,
        ...(kbfsEnabled
          ? ([
              {
                onClick: () => {
                  R.remoteDispatch(RemoteGen.createOpenPathInSystemFileManager({path: '/keybase'}))
                },
                title: `Open folders in ${Kb.Styles.fileUIName}`,
              },
              'Divider',
            ] as const)
          : []),
        ...common,
      ] as const
    }
    return [...openAppItem, ...common] as const
  })()
  return ret
}

const IconBar = (p: Props & {showBadges?: boolean}) => {
  const {navBadges, showBadges} = p
  const openApp = (tab?: C.Tabs.AppTab) => {
    R.remoteDispatch(RemoteGen.createShowMain())
    tab && R.remoteDispatch(RemoteGen.createSwitchTab({tab}))
  }

  const menuItems = useMenuItems({...p, openApp})

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        closeOnSelect={true}
        items={menuItems}
        visible={true}
        onHidden={hidePopup}
        attachTo={attachTo}
        position="bottom right"
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const badgeCountInMenu = badgesInMenu.reduce((acc, val) => (navBadges[val] ?? 0) + acc, 0)
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      alignItems="center"
      style={Kb.Styles.collapseStyles([
        styles.topRow,
        {backgroundColor: isDarkMode ? '#2d2d2d' : Kb.Styles.globalColors.blueDark},
      ])}
    >
      <Kb.Box2 direction="horizontal" alignItems="center" flex={1} style={styles.headerBadgesContainer} justifyContent="center">
        {showBadges
          ? badgeTypesInHeader.map(tab => (
              <BadgeIcon key={tab} tab={tab} countMap={navBadges} openApp={openApp} />
            ))
          : null}
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.hamburgerContainer}>
        <Kb.Box2 direction="vertical" ref={popupAnchor}>
          <Kb.Icon
            color={isDarkMode ? Kb.Styles.globalColors.black_50OrBlack_60 : Kb.Styles.globalColors.blueDarker}
            hoverColor={Kb.Styles.globalColors.whiteOrWhite}
            onClick={showPopup}
            type="iconfont-nav-2-hamburger"
            sizeType="Big"
          />
        </Kb.Box2>
        {!!badgeCountInMenu && <Kb.Badge badgeNumber={badgeCountInMenu} badgeStyle={styles.badge} />}
      </Kb.Box2>
      {popup}
    </Kb.Box2>
  )
}

const badgeTypesInHeader = [C.Tabs.peopleTab, C.Tabs.chatTab, C.Tabs.fsTab, C.Tabs.teamsTab] as const
const badgesInMenu = [C.Tabs.gitTab, C.Tabs.devicesTab, C.Tabs.settingsTab] as const
const LoggedIn = (p: Props) => {
  const {endEstimate, files, following, kbfsDaemonStatus, totalSyncingBytes, fileName} = p
  const {outOfDate, windowShownCount, conversationsToSend, remoteTlfUpdates} = p
  const {httpSrvAddress, httpSrvToken, username} = p

  const refreshUserFileEdits = C.useThrottledCallback(() => {
    R.remoteDispatch(RemoteGen.createUserFileEditsLoad())
  }, 5000)

  React.useEffect(() => {
    if (kbfsDaemonStatus.rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
      return
    }
    refreshUserFileEdits()
  }, [refreshUserFileEdits, windowShownCount, kbfsDaemonStatus.rpcStatus])

  return (
    <>
      <OutOfDate outOfDate={outOfDate} />
      <Kb.ScrollView style={Kb.Styles.globalStyles.flexGrow}>
        <ChatPreview
          convLimit={5}
          conversationsToSend={conversationsToSend}
          httpSrvAddress={httpSrvAddress}
          httpSrvToken={httpSrvToken}
          username={username}
        />
        {kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected ? (
          <FilesPreview
            remoteTlfUpdates={remoteTlfUpdates}
            following={following}
            httpSrvAddress={httpSrvAddress}
            httpSrvToken={httpSrvToken}
          />
        ) : (
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.loadingContainer}>
            <Loading />
          </Kb.Box2>
        )}
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" style={styles.footer}>
        <UploadWithCountdown
          endEstimate={endEstimate}
          isOnline={kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline}
          files={files}
          fileName={fileName}
          totalSyncingBytes={totalSyncingBytes}
          smallMode={true}
        />
      </Kb.Box2>
    </>
  )
}

const LoggedOut = (p: {daemonHandshakeState: T.Config.DaemonHandshakeState; loggedIn: boolean}) => {
  const {daemonHandshakeState, loggedIn} = p

  const fullyLoggedOut = daemonHandshakeState === 'done' && !loggedIn

  const text = fullyLoggedOut
    ? 'You are logged out of Keybase.'
    : daemonHandshakeState === 'waitingForWaiters'
      ? 'Connecting interface to crypto engine... This may take a few seconds.'
      : 'Starting up Keybase...'

  const logIn = () => {
    R.remoteDispatch(RemoteGen.createShowMain())
  }
  return (
    <>
      <Kb.BoxGrow>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={styles.loggedOutContainer}
        >
          <Kb.Box2 direction="vertical">
            <Kb.ImageIcon
              type="icon-keybase-logo-logged-out-64"
              style={styles.logo}
            />
            <Kb.Text type="Body" style={styles.loggedOutText}>
              {text}
            </Kb.Text>
            {fullyLoggedOut ? (
              <Kb.ButtonBar direction="row">
                <Kb.Button label="Log in" onClick={logIn} />
              </Kb.ButtonBar>
            ) : null}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.BoxGrow>
    </>
  )
}

const MenubarRender = (p: Props) => {
  const {loggedIn, daemonHandshakeState} = p
  let content: React.ReactNode
  if (daemonHandshakeState === 'done' && loggedIn) {
    content = <LoggedIn {...p} />
  } else {
    content = <LoggedOut daemonHandshakeState={daemonHandshakeState} loggedIn={loggedIn} />
  }

  React.useEffect(() => {
    document.body.classList.add('isWidget')
  }, [])

  return (
    <Kb.Box2 direction="vertical" flex={1} relative={true} style={styles.widgetContainer}>
      {isDarwin && <ArrowTick />}
      <IconBar {...p} showBadges={loggedIn} />
      {content}
    </Kb.Box2>
  )
}

const TabView = (p: {title: string; iconType: Kb.IconType; count?: number}) => {
  const {count, iconType, title} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
      <Kb.Box2 direction="vertical" relative={true}>
        <Kb.Icon type={iconType} color={Kb.Styles.globalColors.blue} sizeType="Big" />
        {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
      </Kb.Box2>
      <Kb.Text className="title" type="BodySemibold">
        {title}
      </Kb.Text>
    </Kb.Box2>
  )
}

const iconMap = {
  [C.Tabs.peopleTab]: 'iconfont-nav-2-people',
  [C.Tabs.chatTab]: 'iconfont-nav-2-chat',
  [C.Tabs.devicesTab]: 'iconfont-nav-2-devices',
  [C.Tabs.fsTab]: 'iconfont-nav-2-files',
  [C.Tabs.teamsTab]: 'iconfont-nav-2-teams',
  [C.Tabs.gitTab]: undefined,
  [C.Tabs.settingsTab]: undefined,
} as const

type Tabs = (typeof badgeTypesInHeader)[number] | (typeof badgesInMenu)[number]

const BadgeIcon = (p: {tab: Tabs; countMap: {[tab: string]: number}; openApp: (t: Tabs) => void}) => {
  const {tab, countMap, openApp} = p
  const count = countMap[tab]
  const iconType = iconMap[tab]
  const isDarkMode = useColorScheme() === 'dark'

  if ((tab === C.Tabs.devicesTab && !count) || !iconType) {
    return null
  }

  return (
    <Kb.Box2 direction="vertical" style={styles.badgeIconContainer}>
      <Kb.Icon
        color={isDarkMode ? Kb.Styles.globalColors.black_50OrBlack_60 : Kb.Styles.globalColors.blueDarker}
        hoverColor={Kb.Styles.globalColors.whiteOrWhite}
        onClick={() => openApp(tab)}
        sizeType="Big"
        style={styles.navIcons}
        type={iconType}
      />
      {!!count && <Kb.Badge badgeNumber={count} badgeStyle={styles.badge} />}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  arrowTick: {
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderLeftWidth: 6,
    borderRightColor: 'transparent',
    borderRightWidth: 6,
    borderStyle: 'solid',
    height: 0,
    left: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'absolute',
    right: 0,
    top: -6,
    width: 0,
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -4,
  },
  badgeIconContainer: Kb.Styles.platformStyles({
    isElectron: {...Kb.Styles.desktopStyles.clickable, position: 'relative'},
  }),
  buttonContainer: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  chatBadge: {
    backgroundColor: Kb.Styles.globalColors.blue,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  chatContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    color: Kb.Styles.globalColors.black,
  },
  chatRow: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
    },
  }),
  chatRowInner: Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.xsmall),
  chatRowName: {flexShrink: 1},

  chatRowNameLeft: {flexShrink: 1},
  chatRowText: {flexShrink: 1},
  chatSnippet: {color: Kb.Styles.globalColors.black_50},
  chatSnippetUnread: {color: Kb.Styles.globalColors.black},
  chatTimestamp: {color: Kb.Styles.globalColors.black_50, flexShrink: 0, marginLeft: Kb.Styles.globalMargins.tiny},
  fileFullWidth: {width: '100%'},
  fileIcon: {
    flexShrink: 0,
    height: 16,
    marginRight: Kb.Styles.globalMargins.xtiny,
    position: 'relative',
    top: 1,
    width: 16,
  },
  fileIconBadge: {height: 12, width: 12},
  fileIconBadgeBox: {marginLeft: -12, marginRight: 12, marginTop: 12, width: 0, zIndex: 100},
  fileUpdateRow: {
    marginTop: Kb.Styles.globalMargins.xtiny,
    paddingRight: Kb.Styles.globalMargins.large,
  },
  footer: {width: 360},
  hamburgerContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
      marginRight: Kb.Styles.globalMargins.tiny,
      position: 'relative',
    },
  }),
  headerBadgesContainer: {
    marginLeft: Kb.Styles.globalMargins.mediumLarge,
  },
  loadingContainer: {height: 200},
  loggedOutContainer: {padding: Kb.Styles.globalMargins.small},
  loggedOutText: {alignSelf: 'center', marginTop: 6},
  logo: {
    alignSelf: 'center',
    marginBottom: Kb.Styles.globalMargins.xsmall,
  },
  navIcons: {paddingLeft: Kb.Styles.globalMargins.xtiny, paddingRight: Kb.Styles.globalMargins.xtiny},
  showMoreContainer: {marginTop: Kb.Styles.globalMargins.tiny},
  tlfContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    color: Kb.Styles.globalColors.black,
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
  tlfParticipants: {fontSize: 12},
  tlfRowContainer: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
  tlfSectionHeader: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    color: Kb.Styles.globalColors.black_50,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  tlfSectionHeaderContainer: {backgroundColor: Kb.Styles.globalColors.white},
  tlfTime: {marginRight: Kb.Styles.globalMargins.tiny},

  tlfWriterFollowing: {color: Kb.Styles.globalColors.greenDark},
  tlfWriterNotFollowing: {color: Kb.Styles.globalColors.blueDark},
  topRow: {
    borderTopLeftRadius: Kb.Styles.globalMargins.xtiny,
    borderTopRightRadius: Kb.Styles.globalMargins.xtiny,
    flex: 1,
    maxHeight: 40,
    minHeight: 40,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  widgetContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    borderTopLeftRadius: Kb.Styles.globalMargins.xtiny,
    borderTopRightRadius: Kb.Styles.globalMargins.xtiny,
    height: '100%',
    marginTop: isDarwin ? 13 : 0,
    width: '100%',
  },
}))

export default MenubarRender
