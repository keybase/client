// A mirror of the remote menubar windows.
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {useConfigState} from '@/stores/config'
import * as T from '@/constants/types'
import * as React from 'react'
import KB2 from '@/util/electron.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import type {Props, Conversation, RemoteTlfUpdates} from './index.desktop'
import {useColorScheme} from 'react-native'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useNotifState} from '@/stores/notifications'
import type * as NotifConstants from '@/stores/notifications'

const {showTray} = KB2.functions

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotifConstants.BadgeType
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const {widgetBadge, desktopAppBadgeCount} = p
  const systemDarkMode = useDarkModeState(s => s.systemDarkMode)
  React.useEffect(() => {
    showTray?.(desktopAppBadgeCount, widgetBadge)
  }, [widgetBadge, desktopAppBadgeCount, systemDarkMode])
}

const Widget = (p: Props & WidgetProps) => {
  const windowComponent = 'menubar'
  const windowParam = 'menubar'

  const {desktopAppBadgeCount, widgetBadge, ...toSend} = p
  useWidgetBrowserWindow({desktopAppBadgeCount, widgetBadge})
  useSerializeProps(toSend, windowComponent, windowParam)
  return null
}

const GetRowsFromTlfUpdate = (t: T.FS.TlfUpdate, uploads: T.FS.Uploads): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,
  updates: t.history.map(u => {
    const path = T.FS.stringToPath(u.filename)
    return {path, uploading: uploads.syncingPaths.has(path) || uploads.writingToJournal.has(path)}
  }),
  writer: t.writer,
})

const convoDiff = (a: Chat.ConvoState, b: Chat.ConvoState) => {
  if (a === b) return false

  if (a.meta !== b.meta) {
    if (
      a.meta.channelname !== b.meta.channelname ||
      a.meta.snippetDecorated !== b.meta.snippetDecorated ||
      a.meta.teamType !== b.meta.teamType ||
      a.meta.timestamp !== b.meta.timestamp ||
      a.meta.tlfname !== b.meta.tlfname
    ) {
      return true
    }
  }

  if (
    a.badge !== b.badge ||
    a.unread !== b.unread ||
    !C.shallowEqual(a.participants.name, b.participants.name)
  ) {
    return true
  }

  return false
}

function MenubarRemoteProxy() {
  const username = useCurrentUserState(s => s.username)
  const configState = useConfigState(
    C.useShallow(s => {
      const {httpSrv, loggedIn, outOfDate, windowShownCount} = s
      return {httpSrv, loggedIn, outOfDate, windowShownCount}
    })
  )
  const {httpSrv, loggedIn, outOfDate, windowShownCount} = configState
  const fsState = useFSState(
    C.useShallow(s => {
      const {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads} = s
      return {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads}
    })
  )
  const {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads} = fsState
  const {desktopAppBadgeCount, navBadges: navBadgesMap, widgetBadge} = useNotifState(
    C.useShallow(s => {
      const {desktopAppBadgeCount, navBadges, widgetBadge} = s
      return {desktopAppBadgeCount, navBadges, widgetBadge}
    })
  )
  const {widgetList, inboxRefresh, ensureWidgetMetas} = Chat.useChatState(
    C.useShallow(s => ({
      ensureWidgetMetas: s.dispatch.ensureWidgetMetas,
      inboxRefresh: s.dispatch.inboxRefresh,
      widgetList: s.inboxLayout?.widgetList,
    }))
  )
  // Ensure widgetList is populated by triggering an inbox refresh if needed
  React.useEffect(() => {
    if (loggedIn && !widgetList) {
      inboxRefresh('widgetRefresh')
    }
  }, [loggedIn, widgetList, inboxRefresh])
  // Ensure conversation metadata is loaded for widget conversations
  React.useEffect(() => {
    if (widgetList) {
      ensureWidgetMetas()
    }
  }, [widgetList, ensureWidgetMetas])
  const isDarkMode = useColorScheme() === 'dark'
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled

  const remoteTlfUpdates = tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads))

  const [conversationsToSend, setConversationsToSend] = React.useState<ReadonlyArray<Conversation>>([])
  React.useEffect(() => {
    if (!widgetList) return

    const computeConversations = () => {
      const result: Array<Conversation> = []
      widgetList.forEach(v => {
        const cs = Chat.getConvoState(v.convID)
        if (!cs.isMetaGood()) return
        const {badge, unread, participants, meta: c} = cs
        result.push({
          channelname: c.channelname,
          conversationIDKey: v.convID,
          snippetDecorated: c.snippetDecorated,
          teamType: c.teamType,
          timestamp: c.timestamp,
          tlfname: c.tlfname,
          ...(badge > 0 ? {hasBadge: true as const} : {}),
          ...(unread > 0 ? {hasUnread: true as const} : {}),
          ...(participants.name.length ? {participants: participants.name.slice(0, 3)} : {}),
        })
      })
      setConversationsToSend(result)
    }

    computeConversations()

    const unsubs = widgetList.map(v => {
      Chat.getConvoState(v.convID)
      return Chat.chatStores.get(v.convID)?.subscribe((s, old) => {
        if (convoDiff(s, old)) {
          computeConversations()
        }
      })
    })

    return () => {
      for (const unsub of unsubs) {
        unsub?.()
      }
    }
  }, [widgetList])

  // Filter some data based on visible users.
  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.
  const filePaths = [...uploads.syncingPaths].filter(
    path => FS.getPathItem(pathItems, path).type !== T.FS.PathType.Folder
  )

  const upDown = {
    endEstimate: uploads.endEstimate ?? 0,
    filename: T.FS.getPathName(filePaths[1] || T.FS.stringToPath('')),
    files: filePaths.length,
    totalSyncingBytes: uploads.totalSyncingBytes,
  }

  const daemonHandshakeState = useDaemonState(s => s.handshakeState)
  const followingSet = useFollowerState(s => s.following)
  const following = [...followingSet]

  // Convert navBadges Map to plain object
  const navBadges: {[tab: string]: number} = (() => {
    const obj: {[tab: string]: number} = {}
    for (const [k, v] of navBadgesMap) {
      obj[k] = v
    }
    return obj
  })()

  const p: Props & WidgetProps = {
    ...upDown,
    conversationsToSend,
    daemonHandshakeState,
    darkMode: isDarkMode,
    desktopAppBadgeCount,
    diskSpaceStatus,
    following,
    httpSrvAddress: httpSrv.address,
    httpSrvToken: httpSrv.token,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    navBadges,
    outOfDate,
    remoteTlfUpdates,
    showingDiskSpaceBanner: showingBanner,
    username,
    widgetBadge,
    windowShownCount: windowShownCount.get('menu') ?? 0,
  }

  return <Widget {...p} />
}

export default MenubarRemoteProxy
