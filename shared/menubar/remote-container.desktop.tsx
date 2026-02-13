import * as React from 'react'
import * as Chat from '@/stores/chat2'
import Menubar from './index.desktop'
import {useConfigState} from '@/stores/config'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'

const RemoteContainer = (d: DeserializeProps) => {
  const {avatarRefreshCounter, badgeMap, daemonHandshakeState, darkMode, diskSpaceStatus, endEstimate} = d
  const {fileName, files, followers, following, httpSrvAddress, httpSrvToken, infoMap, remoteTlfUpdates} = d
  const {kbfsDaemonStatus, kbfsEnabled, loggedIn, metaMap, navBadges, outOfDate, conversationsToSend} = d
  const {showingDiskSpaceBanner, totalSyncingBytes, unreadMap, username, windowShownCountNum} = d
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  useFollowerState(s => s.dispatch.replace)(followers, following)
  useUsersState(s => s.dispatch.replace)(infoMap)
  const replaceUsername = useCurrentUserState(s => s.dispatch.replaceUsername)
  const setHTTPSrvInfo = useConfigState(s => s.dispatch.setHTTPSrvInfo)
  const setOutOfDate = useConfigState(s => s.dispatch.setOutOfDate)
  const setLoggedIn = useConfigState(s => s.dispatch.setLoggedIn)
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  // defer this so we don't update while rendering
  React.useEffect(() => {
    const id = setTimeout(() => {
      setSystemDarkMode(darkMode)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setSystemDarkMode, darkMode])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceUsername(username)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceUsername, username])

  React.useEffect(() => {
    const id = setTimeout(() => {
      setHTTPSrvInfo(httpSrvAddress, httpSrvToken)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setHTTPSrvInfo, httpSrvAddress, httpSrvToken])

  React.useEffect(() => {
    const id = setTimeout(() => {
      setOutOfDate(outOfDate)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setOutOfDate, outOfDate])

  React.useEffect(() => {
    const id = setTimeout(() => {
      setLoggedIn(loggedIn, false, true)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setLoggedIn, loggedIn])

  React.useEffect(() => {
    const id = setTimeout(() => {
      for (const [id, unread] of unreadMap) {
        Chat.getConvoState(id).dispatch.unreadUpdated(unread)
      }
      for (const [id, badge] of badgeMap) {
        Chat.getConvoState(id).dispatch.badgesUpdated(badge)
      }
      for (const [id, next] of metaMap) {
        Chat.getConvoState(id).dispatch.updateMeta(next)
      }
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [unreadMap, badgeMap, metaMap])

  return (
    <Menubar
      conversationsToSend={conversationsToSend}
      remoteTlfUpdates={remoteTlfUpdates}
      daemonHandshakeState={daemonHandshakeState}
      diskSpaceStatus={diskSpaceStatus}
      endEstimate={endEstimate}
      fileName={fileName}
      files={files}
      kbfsDaemonStatus={kbfsDaemonStatus}
      kbfsEnabled={kbfsEnabled}
      loggedIn={loggedIn}
      navBadges={navBadges}
      outOfDate={outOfDate}
      showingDiskSpaceBanner={showingDiskSpaceBanner}
      totalSyncingBytes={totalSyncingBytes}
      username={username}
      windowShownCount={windowShownCountNum}
    />
  )
}
export default RemoteContainer
