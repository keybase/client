import * as React from 'react'
import * as C from '@/constants'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useUsersState} from '@/constants/users'

const RemoteContainer = (d: DeserializeProps) => {
  const {avatarRefreshCounter, badgeMap, daemonHandshakeState, darkMode, diskSpaceStatus, endEstimate} = d
  const {fileName, files, followers, following, httpSrvAddress, httpSrvToken, infoMap, remoteTlfUpdates} = d
  const {kbfsDaemonStatus, kbfsEnabled, loggedIn, metaMap, navBadges, outOfDate, conversationsToSend} = d
  const {showingDiskSpaceBanner, totalSyncingBytes, unreadMap, username, windowShownCountNum} = d
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  C.useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  C.useFollowerState(s => s.dispatch.replace)(followers, following)
  useUsersState(s => s.dispatch.replace)(infoMap)
  const replaceUsername = C.useCurrentUserState(s => s.dispatch.replaceUsername)
  const setHTTPSrvInfo = C.useConfigState(s => s.dispatch.setHTTPSrvInfo)
  const setOutOfDate = C.useConfigState(s => s.dispatch.setOutOfDate)
  const setLoggedIn = C.useConfigState(s => s.dispatch.setLoggedIn)
  const setSystemDarkMode = C.useDarkModeState(s => s.dispatch.setSystemDarkMode)

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
        C.getConvoState(id).dispatch.unreadUpdated(unread)
      }
      for (const [id, badge] of badgeMap) {
        C.getConvoState(id).dispatch.badgesUpdated(badge)
      }
      for (const [id, next] of metaMap) {
        C.getConvoState(id).dispatch.updateMeta(next)
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
