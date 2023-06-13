// A mirror of the remote tracker windows.
import {useAvatarState} from '../common-adapters/avatar-zus'
import * as React from 'react'
import * as Container from '../util/container'
import * as Constants from '../constants/tracker2'
import * as WaitConstants from '../constants/waiting'
import * as DarkMode from '../constants/darkmode'
import * as Followers from '../constants/followers'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'
import {intersect} from '../util/set'
import {mapFilterByKey} from '../util/map'

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

const RemoteTracker = (props: {trackerUsername: string}) => {
  const {trackerUsername} = props
  const details = Container.useSelector(state => Constants.getDetails(state, trackerUsername))
  const users = Container.useSelector(state => state.users)
  const followers = Followers.useFollowerState(s => s.followers)
  const following = Followers.useFollowerState(s => s.following)
  const {blockMap, infoMap} = users
  const config = Container.useSelector(state => state.config)
  const {httpSrvToken, httpSrvAddress, username} = config
  const {assertions, bio, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details
  const counts = new Map([
    [Constants.waitingKey, WaitConstants.useWaitingState(s => s.counts.get(Constants.waitingKey) ?? 0)],
  ])
  const errors = new Map([
    [Constants.waitingKey, WaitConstants.useWaitingState(s => s.errors.get(Constants.waitingKey))],
  ])
  const trackerUsernames = new Set([trackerUsername])
  const blocked = blockMap.get(trackerUsername)?.chatBlocked || false

  const avatarCount = useAvatarState(s => s.counts.get(trackerUsername) ?? 0)

  const avatarRefreshCounter = React.useMemo(() => {
    return new Map([[trackerUsername, avatarCount]])
  }, [trackerUsername, avatarCount])

  const darkMode = DarkMode.useDarkModeState(s => s.isDarkMode())

  const p: ProxyProps = {
    assertions,
    avatarRefreshCounter,
    bio,
    blockMap: mapFilterByKey(blockMap, trackerUsernames),
    blocked,
    counts,
    darkMode,
    errors,
    followers: intersect(followers, trackerUsernames),
    followersCount,
    following: intersect(following, trackerUsernames),
    followingCount,
    fullname,
    guiID,
    hidFromFollowers,
    httpSrvAddress,
    httpSrvToken,
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
  const showTrackerSet = Container.useSelector(s => s.tracker2.showTrackerSet)
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
