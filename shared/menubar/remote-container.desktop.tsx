import * as ConfigConstants from '../constants/config'
import * as UsersConstants from '../constants/users'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import * as Followers from '../constants/followers'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const RemoteContainer = () => {
  const {
    avatarRefreshCounter,
    badgeMap,
    daemonHandshakeState,
    darkMode,
    diskSpaceStatus,
    // draftMap,
    endEstimate,
    fileName,
    files,
    followers,
    following,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    metaMap,
    // mutedMap,
    navBadges,
    outOfDate,
    // participantMap,
    showingDiskSpaceBanner,
    totalSyncingBytes,
    unreadMap,
    username,
    windowShownCountNum,
  } = Container.useRemoteStore<DeserializeProps>()
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  ConfigConstants.useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  Followers.useFollowerState(s => s.dispatch.replace)(followers, following)
  UsersConstants.useState(s => s.dispatch.replace)(infoMap)
  ConfigConstants.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
  ConfigConstants.useConfigState(s => s.dispatch.setHTTPSrvInfo)(httpSrvAddress, httpSrvToken)
  ConfigConstants.useConfigState(s => s.dispatch.setOutOfDate)(outOfDate)
  ConfigConstants.useConfigState(s => s.dispatch.setLoggedIn)(loggedIn, false)
  for (const [id, unread] of unreadMap) {
    ChatConstants.getConvoState(id).dispatch.unreadUpdated(unread)
  }
  for (const [id, badge] of badgeMap) {
    ChatConstants.getConvoState(id).dispatch.badgesUpdated(badge)
  }
  for (const [id, meta] of metaMap) {
    ChatConstants.getConvoState(id).dispatch.updateMeta(meta)
  }
  console.log('aaaa', metaMap)

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
