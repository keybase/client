// A mirror of the remote tracker windows.
import type * as React from 'react'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {useColorScheme} from 'react-native'
import {useTrackerState} from '@/stores/tracker'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import type {Props as TrackerProps} from './index.desktop'

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

type ProxyProps = Omit<TrackerProps, 'onAccept' | 'onChat' | 'onClose' | 'onFollow' | 'onIgnoreFor24Hours' | 'onReload'>

const RemoteTracker = (props: {trackerUsername: string}) => {
  const {trackerUsername} = props
  const details = useTrackerState(s => s.getDetails(trackerUsername))
  const blockMap = useUsersState(s => s.blockMap)
  const followers = useFollowerState(s => s.followers)
  const following = useFollowerState(s => s.following)
  const username = useCurrentUserState(s => s.username)
  const httpSrv = useConfigState(s => s.httpSrv)
  const {assertions, bio, followersCount, followingCount, fullname, guiID} = details
  const {hidFromFollowers, location, reason, teamShowcase} = details
  const isDarkMode = useColorScheme() === 'dark'
  const blocked = blockMap.get(trackerUsername)?.chatBlocked || false

  const p: ProxyProps = {
    assertions: assertions ? [...assertions.values()] : undefined,
    bio,
    blocked,
    darkMode: isDarkMode,
    followThem: following.has(trackerUsername),
    followersCount,
    followingCount,
    followsYou: followers.has(trackerUsername),
    fullname,
    guiID,
    hidFromFollowers,
    httpSrvAddress: httpSrv.address,
    httpSrvToken: httpSrv.token,
    isYou: username === trackerUsername,
    location,
    reason,
    state: details.state,
    teamShowcase,
    trackerUsername,
  }

  const windowComponent = 'tracker'
  const windowParam = trackerUsername
  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${trackerUsername}`,
  })

  useSerializeProps(p, windowComponent, windowParam)

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
