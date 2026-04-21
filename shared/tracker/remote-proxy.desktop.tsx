// A mirror of the remote tracker windows.
import * as React from 'react'
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
import {makeDetails, rpcAssertionToAssertion} from './model'
import {registerTrackerPopupHandlers} from './desktop-popup-handles'
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

type LoadPayload = {
  assertion: string
  forceDisplay?: boolean
  fromDaemon?: boolean
  guiID: string
  ignoreCache?: boolean
  inTracker: boolean
  reason: string
}

const initialPopupState = (): PopupState => ({
  showTrackerSet: new Set(),
  usernameToDetails: new Map(),
})

const guiIDToUsername = (state: PopupState, guiID: string) => {
  const details = [...state.usernameToDetails.values()].find(d => d.guiID === guiID)
  return details?.username
}

const cloneDetails = (details: T.Tracker.Details): T.Tracker.Details => ({
  ...details,
  assertions: new Map(details.assertions ?? []),
  followers: details.followers ? new Set(details.followers) : details.followers,
  following: details.following ? new Set(details.following) : details.following,
  teamShowcase: [...(details.teamShowcase ?? [])],
  webOfTrustEntries: [...(details.webOfTrustEntries ?? [])],
})

const rpcResultToStatus = (result: T.RPCGen.Identify3ResultType): T.Tracker.DetailsState => {
  switch (result) {
    case T.RPCGen.Identify3ResultType.ok:
      return 'valid'
    case T.RPCGen.Identify3ResultType.broken:
      return 'broken'
    case T.RPCGen.Identify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case T.RPCGen.Identify3ResultType.canceled:
    default:
      return 'error'
  }
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
  const details = cloneDetails(current)
  const newReason =
    reason ||
    (result === 'broken' && `Some of ${username}'s proofs have changed since you last followed them.`)
  const nextDetails = {
    ...details,
    reason:
      !details.resetBrokeTrack || details.reason.length === 0 ? newReason || details.reason : details.reason,
    resetBrokeTrack: result === 'valid' ? false : details.resetBrokeTrack,
    state: result,
  }
  const usernameToDetails = new Map(state.usernameToDetails)
  usernameToDetails.set(username, nextDetails)
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
      forceDisplay && showTrackerSet.add(assertion)
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
      registerTrackerPopupHandlers({
        changeFollow,
        closeTracker,
        ignore,
        load,
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
    setPopupState(prev => updateResult(prev, guiID, rpcResultToStatus(result)))
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
    const {blocks} = action.payload.params.b
    setPopupState(prev => {
      if (!prev.usernameToDetails.size) {
        return prev
      }
      const usernameToDetails = new Map(prev.usernameToDetails)
      let changed = false
      Object.entries(blocks ?? {}).forEach(([username, blockStates]) => {
        const current = usernameToDetails.get(username)
        if (!current) {
          return
        }
        const details = cloneDetails(current)
        let blocked = details.blocked
        let hidFromFollowers = details.hidFromFollowers
        let localChange = false
        blockStates?.forEach(blockState => {
          if (blockState.blockType === T.RPCGen.UserBlockType.chat) {
            blocked = blockState.blocked
            localChange = true
          } else {
            hidFromFollowers = blockState.blocked
            localChange = true
          }
        })
        if (localChange) {
          changed = true
          usernameToDetails.set(username, {...details, blocked, hidFromFollowers})
        }
      })
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
      const details = cloneDetails(current)
      const assertion = rpcAssertionToAssertion(row)
      const assertions = new Map(details.assertions ?? [])
      assertions.set(assertion.assertionKey, assertion)
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, {...details, assertions})
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
      const details = cloneDetails(current)
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, {
        ...details,
        reason: `${username} reset their account since you last followed them.`,
        resetBrokeTrack: true,
      })
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
      const details = cloneDetails(current)
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, {
        ...details,
        bio: card.bio,
        blocked: card.blocked,
        followersCount: card.unverifiedNumFollowers,
        followingCount: card.unverifiedNumFollowing,
        fullname: card.fullName,
        hidFromFollowers: card.hidFromFollowers,
        location: card.location,
        stellarHidden: card.stellarHidden,
        teamShowcase:
          card.teamShowcase?.map(t => ({
            description: t.description,
            isOpen: t.open,
            membersCount: t.numMembers,
            name: t.fqName,
            publicAdmins: t.publicAdmins ?? [],
          })) ?? [],
      })
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
      const details = cloneDetails(current)
      const usernameToDetails = new Map(prev.usernameToDetails)
      usernameToDetails.set(username, {...details, numAssertionsExpected: summary.numProofsToCheck})
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
