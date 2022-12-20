// A mirror of the remote tracker windows.
import * as Container from '../util/container'
import * as Constants from '../constants/tracker2'
import * as Styles from '../styles'
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
  const {blockMap, infoMap} = users
  const config = Container.useSelector(state => state.config)
  const {avatarRefreshCounter, following, followers, httpSrvToken, httpSrvAddress, username} = config
  const {assertions, bio, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details
  const waiting = Container.useSelector(state => state.waiting)
  const {counts, errors} = waiting
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
