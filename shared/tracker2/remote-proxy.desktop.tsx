// A mirror of the remote tracker windows.
import * as React from 'react'
import * as Container from '../util/container'
import * as Constants from '../constants/tracker2'
import * as Styles from '../styles'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {serialize, ProxyProps} from './remote-serializer.desktop'
import {intersect} from '../util/set'
import {mapFilterByKey} from '../util/map'

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

const RemoteTracker = (props: {trackerUsername: string}) => {
  const {trackerUsername} = props
  const state = Container.useSelector(s => s)
  const details = Constants.getDetails(state, trackerUsername)
  const {blockMap, infoMap} = state.users
  const {avatarRefreshCounter, following, followers, httpSrvToken, httpSrvAddress, username} = state.config
  const {assertions, bio, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details
  const {counts, errors} = state.waiting
  const trackerUsernames = new Set([trackerUsername])
  const waitingKeys = new Set([Constants.waitingKey])
  const blocked = blockMap.get(trackerUsername)?.chatBlocked || false
  const p: ProxyProps = {
    assertions,
    avatarRefreshCounter,
    bio,
    blockMap: mapFilterByKey(blockMap, trackerUsernames),
    blocked,
    counts: mapFilterByKey(counts, waitingKeys),
    darkMode: Styles.isDarkMode(),
    errors: mapFilterByKey(errors, waitingKeys),
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
    showTracker: true,
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
  const state = Container.useSelector(s => s)
  const {usernameToDetails} = state.tracker2
  return (
    <>
      {[...usernameToDetails.values()].reduce<Array<React.ReactNode>>((arr, u) => {
        if (arr.length < MAX_TRACKERS && u.showTracker) {
          arr.push(<RemoteTracker key={u.username} trackerUsername={u.username} />)
        }
        return arr
      }, [])}
    </>
  )
}

export default RemoteTrackers
