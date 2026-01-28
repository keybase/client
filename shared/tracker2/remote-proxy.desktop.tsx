// A mirror of the remote tracker windows.
import * as C from '@/constants'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useConfigState} from '@/stores/config'
import * as React from 'react'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'
import {intersect} from '@/util/set'
import {mapFilterByKey} from '@/util/map'
import {useColorScheme} from 'react-native'
import {useTrackerState} from '@/stores/tracker2'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

const RemoteTracker = (props: {trackerUsername: string}) => {
  const {trackerUsername} = props
  const details = useTrackerState(s => s.getDetails(trackerUsername))
  const infoMap = useUsersState(s => s.infoMap)
  const blockMap = useUsersState(s => s.blockMap)
  const followers = useFollowerState(s => s.followers)
  const following = useFollowerState(s => s.following)
  const username = useCurrentUserState(s => s.username)
  const httpSrv = useConfigState(s => s.httpSrv)
  const {assertions, bio, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details
  const counts = new Map([
    [C.waitingKeyTracker, C.useWaitingState(s => s.counts.get(C.waitingKeyTracker) ?? 0)],
  ])
  const errors = new Map([[C.waitingKeyTracker, C.useWaitingState(s => s.errors.get(C.waitingKeyTracker))]])
  const trackerUsernames = new Set([trackerUsername])
  const blocked = blockMap.get(trackerUsername)?.chatBlocked || false

  const avatarCount = useAvatarState(s => s.counts.get(trackerUsername) ?? 0)

  const avatarRefreshCounter = React.useMemo(() => {
    return new Map([[trackerUsername, avatarCount]])
  }, [trackerUsername, avatarCount])

  const isDarkMode = useColorScheme() === 'dark'

  const p: ProxyProps = {
    assertions,
    avatarRefreshCounter,
    bio,
    blockMap: mapFilterByKey(blockMap, trackerUsernames),
    blocked,
    counts,
    darkMode: isDarkMode,
    errors,
    followers: intersect(followers, trackerUsernames),
    followersCount,
    following: intersect(following, trackerUsernames),
    followingCount,
    fullname,
    guiID,
    hidFromFollowers,
    httpSrvAddress: httpSrv.address,
    httpSrvToken: httpSrv.token,
    infoMap: mapFilterByKey(infoMap, trackerUsernames),
    location,
    reason,
    resetBrokeTrack: false,
    state: details.state,
    teamShowcase,
    trackerUsername,
    username,
  }

  const windowComponent = 'tracker2'
  const windowParam = trackerUsername
  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${trackerUsername}`,
  })

  useSerializeProps(p, serialize, windowComponent, windowParam)

  return null
}

const RemoteTrackers = () => {
  const showTrackerSet = useTrackerState(s => s.showTrackerSet)
  return (
    <>
      {[...showTrackerSet].reduce<Array<React.ReactNode>>((arr, username) => {
        if (arr.length < MAX_TRACKERS) {
          arr.push(<RemoteTracker key={username} trackerUsername={username} />)
        }
        return arr
      }, [])}
    </>
  )
}

export default RemoteTrackers
