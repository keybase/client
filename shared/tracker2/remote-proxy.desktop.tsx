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

const RemoteTracker = (props: {username: string}) => {
  const {username} = props
  const state = Container.useSelector(s => s)
  const details = Constants.getDetails(state, username)
  const {infoMap} = state.users
  const {avatarRefreshCounter, following, followers, httpSrvToken, httpSrvAddress} = state.config
  const {assertions, bio, blocked, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details

  const usernames = new Set([username])
  const p: ProxyProps = {
    // waiting: Container.anyWaiting(state, Constants.waitingKey),
    assertions,
    avatarRefreshCounter,
    bio,
    blocked,
    darkMode: Styles.isDarkMode(),
    // followThem: Constants.followThem(state, username),
    followers: intersect(followers, usernames),
    followersCount,
    following: intersect(following, usernames),
    followingCount,
    // followsYou: Constants.followsYou(state, username),
    fullname,
    guiID,
    hidFromFollowers,
    httpSrvAddress,
    httpSrvToken,
    infoMap: mapFilterByKey(infoMap, usernames),
    isYou: state.config.username === username,
    location,
    reason,
    state: details.state,
    teamShowcase,
    username,
  }

  const windowComponent = 'tracker2'
  const windowParam = username
  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${username}`,
  })

  useSerializeProps(p, serialize, windowComponent, windowParam)

  return null
}

const RemoteTrackers = () => {
  const state = Container.useSelector(s => s)
  const {usernameToDetails} = state.tracker2
  return (
    <>
      {[...usernameToDetails.values()].slice(0, MAX_TRACKERS).map(u => (
        <RemoteTracker key={u.username} username={u.username} />
      ))}
    </>
  )
}

export default RemoteTrackers
