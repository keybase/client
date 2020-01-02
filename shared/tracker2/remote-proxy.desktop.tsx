// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTracker is a single tracker popup
import * as React from 'react'
import * as Container from '../util/container'
import * as Constants from '../constants/tracker2'
import * as ConfigConstants from '../constants/config'
import * as Styles from '../styles'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {serialize} from './remote-serializer.desktop'

type OwnProps = {username: string}

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}
// @ts-ignore
const RemoteTracker: any = SyncAvatarProps(SyncProps(serialize)(Container.NullComponent))

const RemoteTracker2 = (props: OwnProps) => {
  const {username} = props
  const state = Container.useSelector(s => s)
  const d = Constants.getDetails(state, username)
  const p = {
    assertions: d.assertions,
    bio: d.bio,
    blocked: d.blocked,
    darkMode: Styles.isDarkMode(),
    followThem: Constants.followThem(state, username),
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: Constants.followsYou(state, username),
    fullname: d.fullname,
    guiID: d.guiID,
    hidFromFollowers: d.hidFromFollowers,
    isYou: state.config.username === username,
    location: d.location,
    reason: d.reason,
    state: d.state,
    teamShowcase: d.teamShowcase,
    waiting: Container.anyWaiting(state, Constants.waitingKey),
  }

  const opts = {
    windowComponent: 'tracker2',
    windowOpts,
    windowParam: username,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${username}`,
  } as const
  useBrowserWindow(opts)

  return (
    <RemoteTracker
      {...p}
      username={username}
      remoteWindowNeedsProps={ConfigConstants.getRemoteWindowPropsCount(state.config, 'tracker2', username)}
      windowComponent={opts.windowComponent}
      windowParam={opts.windowParam}
    />
  )
}

type Props = {
  users: Array<string>
}

const RemoteTracker2s = React.memo((p: Props) => (
  <>
    {p.users.map(username => (
      <RemoteTracker2 username={username} key={username} />
    ))}
  </>
))

export default Container.connect(
  state => ({_users: state.tracker2.usernameToDetails}),
  () => ({}),
  (stateProps, _, __) => ({
    users: [...stateProps._users.values()].reduce<Array<string>>((arr, u) => {
      if (arr.length < MAX_TRACKERS) {
        if (u.showTracker) {
          arr.push(u.username)
        }
      }
      return arr
    }, []),
  })
)(RemoteTracker2s)
