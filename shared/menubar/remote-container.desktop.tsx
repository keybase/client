import * as C from '../constants'
import * as Container from '../util/container'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const RemoteContainer = () => {
  const d = Container.useRemoteStore<DeserializeProps>()
  const {avatarRefreshCounter, badgeMap, daemonHandshakeState, darkMode, diskSpaceStatus, endEstimate} = d
  const {fileName, files, followers, following, httpSrvAddress, httpSrvToken, infoMap} = d
  const {kbfsDaemonStatus, kbfsEnabled, loggedIn, metaMap, navBadges, outOfDate} = d
  const {showingDiskSpaceBanner, totalSyncingBytes, unreadMap, username, windowShownCountNum} = d
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  C.useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  C.useFollowerState(s => s.dispatch.replace)(followers, following)
  C.useUsersState(s => s.dispatch.replace)(infoMap)
  C.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
  C.useConfigState(s => s.dispatch.setHTTPSrvInfo)(httpSrvAddress, httpSrvToken)
  C.useConfigState(s => s.dispatch.setOutOfDate)(outOfDate)
  C.useConfigState(s => s.dispatch.setLoggedIn)(loggedIn, false)
  for (const [id, unread] of unreadMap) {
    C.getConvoState(id).dispatch.unreadUpdated(unread)
  }
  for (const [id, badge] of badgeMap) {
    C.getConvoState(id).dispatch.badgesUpdated(badge)
  }
  for (const [id, meta] of metaMap) {
    C.getConvoState(id).dispatch.updateMeta(meta)
  }
  return (
    <Menubar
      daemonHandshakeState={daemonHandshakeState}
      darkMode={darkMode}
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
