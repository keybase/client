// A mirror of the remote tracker windows.
import * as React from 'react'
import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import {generateGUIID, ignorePromise} from '@/constants/utils'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import {useColorScheme} from 'react-native'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {useEngineActionListener} from '@/engine/action-listener'
import type {Props as TrackerProps} from './index.desktop'
import {
  cloneDetails,
  identifyResultToDetailsState,
  makeDetails,
  updateTrackerDetailsBlocked,
  updateTrackerDetailsReset,
  updateTrackerDetailsResult,
  updateTrackerDetailsRow,
  updateTrackerDetailsSummary,
  updateTrackerDetailsUserCard,
} from './model'
import {registerRemoteActionHandler} from '@/desktop/renderer/remote-event-handler.desktop'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

type ProxyProps = Omit<
  TrackerProps,
  'onAccept' | 'onChat' | 'onClose' | 'onFollow' | 'onIgnoreFor24Hours' | 'onReload'
>

type PopupState = {
  showTrackerSet: Set<string>
  usernameToDetails: Map<string, T.Tracker.Details>
}

type LoadPayload = RemoteGen.TrackerLoadPayload['payload']

const initialPopupState = (): PopupState => ({
  showTrackerSet: new Set(),
  usernameToDetails: new Map(),
})

const guiIDToUsername = (state: PopupState, guiID: string) => {
  const details = [...state.usernameToDetails.values()].find(d => d.guiID === guiID)
  return details?.username
}

const updateResult = (state: PopupState, guiID: string, result: T.Tracker.DetailsState, reason?: string) => {
  const username = guiIDToUsername(state, guiID)
  if (!username) {
    return state
  }
  const current = state.usernameToDetails.get(username)
  if (!current) {
    return state
  }
  const usernameToDetails = new Map(state.usernameToDetails)
  usernameToDetails.set(username, updateTrackerDetailsResult(current, result, reason))
  return {...state, usernameToDetails}
}

const RemoteTracker = (props: {details: T.Tracker.Details; trackerUsername: string}) => {
  const {details, trackerUsername} = props
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
  const [popupState, setPopupState] = React.useState<PopupState>(initialPopupState)
  const popupStateRef = React.useRef(popupState)

  React.useEffect(() => {
    popupStateRef.current = popupState
  }, [popupState])

  const load = React.useCallback((p: LoadPayload) => {
    const {assertion, forceDisplay, fromDaemon, guiID, ignoreCache = false, reason} = p
    setPopupState(prev => {
      const showTrackerSet = new Set(prev.showTrackerSet)
      const usernameToDetails = new Map(prev.usernameToDetails)
      if (forceDisplay) {
        showTrackerSet.add(assertion)
      }
      const details = cloneDetails(usernameToDetails.get(assertion) ?? makeDetails(assertion))
      usernameToDetails.set(assertion, {
        ...details,
        assertions: new Map(),
        guiID,
        reason,
        state: 'checking',
        username: assertion,
      })
      return {showTrackerSet, usernameToDetails}
    })

    if (fromDaemon) {
      return
    }

    const f = async () => {
      try {
        await T.RPCGen.identify3Identify3RpcListener({
          incomingCallMap: {},
          params: {assertion, guiID, ignoreCache},
          waitingKey: 'tracker:profileLoad',
        })
      } catch (error) {
        if (error instanceof RPCError) {
          logger.error(`Error loading tracker popup: ${error.message}`)
          setPopupState(prev => updateResult(prev, guiID, 'error'))
        }
      }
    }
    ignorePromise(f())
  }, [])

  const closeTracker = React.useCallback((guiID: string) => {
    setPopupState(prev => {
      const username = guiIDToUsername(prev, guiID)
      if (!username) {
        return prev
      }
      const showTrackerSet = new Set(prev.showTrackerSet)
      const usernameToDetails = new Map(prev.usernameToDetails)
      showTrackerSet.delete(username)
      usernameToDetails.delete(username)
      return {showTrackerSet, usernameToDetails}
    })
  }, [])

  const changeFollow = React.useCallback((guiID: string, follow: boolean) => {
    const f = async () => {
      try {
        await T.RPCGen.identify3Identify3FollowUserRpcPromise({follow, guiID}, 'tracker:waitingKey')
        setPopupState(prev =>
          updateResult(prev, guiID, 'valid', `Successfully ${follow ? 'followed' : 'unfollowed'}!`)
        )
      } catch {
        setPopupState(prev =>
          updateResult(prev, guiID, 'error', `Failed to ${follow ? 'follow' : 'unfollow'}`)
        )
      }
    }
    ignorePromise(f())
  }, [])

  const ignore = React.useCallback((guiID: string) => {
    const f = async () => {
      try {
        await T.RPCGen.identify3Identify3IgnoreUserRpcPromise({guiID}, 'tracker:waitingKey')
        setPopupState(prev => updateResult(prev, guiID, 'valid', 'Successfully ignored'))
      } catch {
        setPopupState(prev => updateResult(prev, guiID, 'error', 'Failed to ignore'))
      }
    }
    ignorePromise(f())
  }, [])

  React.useEffect(
    () =>
      registerRemoteActionHandler('tracker', action => {
        switch (action.type) {
          case RemoteGen.trackerChangeFollow:
            changeFollow(action.payload.guiID, action.payload.follow)
            break
          case RemoteGen.trackerIgnore:
            ignore(action.payload.guiID)
            break
          case RemoteGen.trackerCloseTracker:
            closeTracker(action.payload.guiID)
            break
          case RemoteGen.trackerLoad:
            load(action.payload)
            break
        }
      }),
    [changeFollow, closeTracker, ignore, load]
  )

  useEngineActionListener('keybase.1.NotifyTracking.trackingChanged', action => {
    const username = action.payload.params.username
    if (!popupStateRef.current.usernameToDetails.has(username)) {
      return
    }
    load({
      assertion: username,
      forceDisplay: false,
      fromDaemon: false,
      guiID: generateGUIID(),
      ignoreCache: true,
      inTracker: true,
      reason: '',
    })
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3Result', action => {
    const {guiID, result} = action.payload.params
    setPopupState(prev => updateResult(prev, guiID, identifyResultToDetailsState(result)))
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3ShowTracker', action => {
    const {assertion, forceDisplay = false, guiID, reason} = action.payload.params
    load({
      assertion,
      forceDisplay,
      fromDaemon: true,
      guiID,
      ignoreCache: false,
      inTracker: true,
      reason: reason.reason,
    })
  })

  useEngineActionListener('keybase.1.NotifyTracking.notifyUserBlocked', action => {
    setPopupState(prev => {
      if (!prev.usernameToDetails.size) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      let changed = false
      for (const username of usernameToDetails.keys()) {
        const current = usernameToDetails.get(username)
        if (!current) {
          continue
        }
        const nextDetails = updateTrackerDetailsBlocked(current, action.payload.params.b)
        if (nextDetails !== current) {
          changed = true
          usernameToDetails.set(username, nextDetails)
        }
      }
      return changed ? {...prev, usernameToDetails} : prev
    })
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UpdateRow', action => {
    const {row} = action.payload.params
    setPopupState(prev => {
      const username = guiIDToUsername(prev, row.guiID)
      if (!username) {
        return prev
      }
      const current = prev.usernameToDetails.get(username)
      if (!current) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, updateTrackerDetailsRow(current, row))
      return {...prev, usernameToDetails}
    })
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UserReset', action => {
    const {guiID} = action.payload.params
    setPopupState(prev => {
      const username = guiIDToUsername(prev, guiID)
      if (!username) {
        return prev
      }
      const current = prev.usernameToDetails.get(username)
      if (!current) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, updateTrackerDetailsReset(current))
      return {...prev, usernameToDetails}
    })
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UpdateUserCard', action => {
    const {guiID, card} = action.payload.params
    setPopupState(prev => {
      const username = guiIDToUsername(prev, guiID)
      if (!username) {
        return prev
      }
      const current = prev.usernameToDetails.get(username)
      if (!current) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, updateTrackerDetailsUserCard(current, card))
      return {...prev, usernameToDetails}
    })
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3Summary', action => {
    const {summary} = action.payload.params
    setPopupState(prev => {
      const username = guiIDToUsername(prev, summary.guiID)
      if (!username) {
        return prev
      }
      const current = prev.usernameToDetails.get(username)
      if (!current) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, updateTrackerDetailsSummary(current, summary))
      return {...prev, usernameToDetails}
    })
  })

  return (
    <>
      {[...popupState.showTrackerSet].reduce<Array<React.ReactNode>>((arr, username) => {
        const details = popupState.usernameToDetails.get(username)
        if (arr.length < MAX_TRACKERS && details) {
          arr.push(<RemoteTracker key={username} trackerUsername={username} details={details} />)
        }
        return arr
      }, [])}
    </>
  )
}

export default RemoteTrackers
