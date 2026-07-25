import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {generateGUIID, ignorePromise} from '@/constants/utils'
import {navigateAppend, navigateUp} from '@/constants/router'
import {produce} from 'immer'
import {registerExternalResetter} from '@/util/zustand'
import {subscribeToEngineAction} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {
  identifyResultToDetailsState,
  makeDetails,
  noNonUserDetails,
  updateTrackerDetailsBlocked,
  updateTrackerDetailsReset,
  updateTrackerDetailsResult,
  updateTrackerDetailsRow,
  updateTrackerDetailsSummary,
  updateTrackerDetailsUserCard,
} from './model'

// One identify per user, shared by every surface showing that user. An
// Identify3 with ignoreCache re-fetches every proof from the third party host,
// so N surfaces each running their own identify is N times the load on those
// hosts (and the service serializes them per uid, so they also run back to
// back). Instead a single session per username owns the identify, accumulates
// every identify3Ui event for it, and fans the result out to its subscribers -
// including ones that join after the identify already started.
type Session = {
  details: T.Tracker.Details
  generation: number
  ignoreCache: boolean
  inFlight: boolean
  nonUserDetails: T.Tracker.NonUserDetails
  startedAt: number
  username: string
}

export type IdentifyLoadOptions = {
  // Join an identify that is already running only if it started at or after
  // this timestamp, mirroring the singleflight in go/libkb/proof_cache.go.
  // 0: any in-flight identify is good enough (mount, focus).
  // Date.now(): only one started in reaction to the same event (notifications).
  // Infinity: never join, always a fresh identify (explicit user reload).
  freshAfter: number
  ignoreCache: boolean
}

const sessions = new Map<string, Session>()
// Kept outside of Session so a subscriber stays attached to its username even
// if the session object behind it is replaced.
const subscribersByUsername = new Map<string, Set<() => void>>()

const notify = (username: string) => {
  const subscribers = subscribersByUsername.get(username)
  if (!subscribers?.size) {
    return
  }
  for (const cb of [...subscribers]) {
    cb()
  }
}

const setDetails = (s: Session, next: T.Tracker.Details) => {
  if (next === s.details) {
    return
  }
  s.details = next
  notify(s.username)
}

const makeSession = (username: string): Session => ({
  details: makeDetails(username),
  generation: 0,
  ignoreCache: false,
  inFlight: false,
  nonUserDetails: noNonUserDetails,
  startedAt: 0,
  username,
})

const ensureSession = (username: string) => {
  const existing = sessions.get(username)
  if (existing) {
    return existing
  }
  const created = makeSession(username)
  sessions.set(username, created)
  return created
}

const dropSessionIfIdle = (s: Session) => {
  if (s.inFlight || subscribersByUsername.get(s.username)?.size) {
    return
  }
  if (sessions.get(s.username) === s) {
    sessions.delete(s.username)
  }
}

const sessionForGuiID = (guiID: string) => {
  for (const s of sessions.values()) {
    if (s.details.guiID === guiID) {
      return s
    }
  }
  return undefined
}

const loadNonUserDetails = async (s: Session, generation: number) => {
  const assertion = s.username
  try {
    const res = await T.RPCGen.userSearchGetNonUserDetailsRpcPromise({assertion})
    if (s.generation !== generation || !res.isNonUser) {
      return
    }
    const common = {
      assertionKey: res.assertionKey,
      assertionValue: res.assertionValue,
      description: res.description,
      siteIcon: res.siteIcon || [],
      siteIconDarkmode: res.siteIconDarkmode || [],
      siteIconFull: res.siteIconFull || [],
      siteIconFullDarkmode: res.siteIconFullDarkmode || [],
      siteURL: '',
    }
    if (res.service) {
      s.nonUserDetails = {...noNonUserDetails, ...common, ...res.service}
      notify(s.username)
    } else {
      const {formatPhoneNumberInternational} = await import('@/util/phone-numbers')
      const formattedName =
        res.assertionKey === 'phone' ? formatPhoneNumberInternational('+' + res.assertionValue) : undefined
      const fullName = res.contact?.contactName ?? ''
      if (s.generation !== generation) {
        return
      }
      s.nonUserDetails = {...noNonUserDetails, ...common, formattedName, fullName}
      notify(s.username)
    }
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn(`Error loading non user profile: ${error.message}`)
    }
  } finally {
    dropSessionIfIdle(s)
  }
}

export const loadNonUserProfile = (username: string) => {
  if (!username) {
    return
  }
  const s = ensureSession(username)
  ignorePromise(loadNonUserDetails(s, s.generation))
}

const runIdentify = async (s: Session, generation: number, guiID: string, ignoreCache: boolean) => {
  try {
    await T.RPCGen.identify3Identify3RpcListener({
      incomingCallMap: {},
      params: {assertion: s.username, guiID, ignoreCache},
      waitingKey: C.waitingKeyTrackerProfileLoad,
    })
  } catch (error) {
    if (!(error instanceof RPCError) || s.generation !== generation) {
      return
    }
    if (error.code === T.RPCGen.StatusCode.scresolutionfailed) {
      setDetails(
        s,
        produce(s.details, draft => {
          draft.state = 'notAUserYet'
        })
      )
      loadNonUserProfile(s.username)
    } else if (error.code === T.RPCGen.StatusCode.scnotfound) {
      navigateUp()
      navigateAppend({
        name: 'keybaseLinkError',
        params: {
          error: `You followed a profile link for a user (${s.username}) that does not exist.`,
        },
      })
    }
    logger.error(`Error loading profile: ${error.message}`)
  } finally {
    if (s.generation === generation) {
      s.inFlight = false
      dropSessionIfIdle(s)
    }
  }
}

const loadFollowers = async (s: Session, generation: number) => {
  try {
    const fs = await T.RPCGen.userListTrackersUnverifiedRpcPromise(
      {assertion: s.username},
      C.waitingKeyTrackerProfileLoad
    )
    if (s.generation !== generation) {
      return
    }
    setDetails(
      s,
      produce(s.details, draft => {
        draft.followers = new Set((fs.users ?? []).map(f => f.username))
        draft.followersCount = fs.users?.length ?? 0
      })
    )
    if (fs.users) {
      useUsersState
        .getState()
        .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
    }
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Error loading follower info: ${error.message}`)
    }
  }
}

const loadFollowing = async (s: Session, generation: number) => {
  try {
    const fs = await T.RPCGen.userListTrackingRpcPromise(
      {assertion: s.username, filter: ''},
      C.waitingKeyTrackerProfileLoad
    )
    if (s.generation !== generation) {
      return
    }
    setDetails(
      s,
      produce(s.details, draft => {
        draft.following = new Set((fs.users ?? []).map(f => f.username))
        draft.followingCount = fs.users?.length ?? 0
      })
    )
    if (fs.users) {
      useUsersState
        .getState()
        .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
    }
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Error loading following info: ${error.message}`)
    }
  }
}

export const loadProfileIdentify = (username: string, options: IdentifyLoadOptions) => {
  if (!username) {
    return
  }
  ensureEngineSubscriptions()
  const {freshAfter, ignoreCache} = options
  const s = ensureSession(username)
  // A weaker in-flight identify (one that was allowed to use the proof cache)
  // cannot stand in for a caller that asked for a forced remote check.
  const strongEnough = s.ignoreCache || !ignoreCache
  if (s.inFlight && strongEnough && s.startedAt >= freshAfter) {
    return
  }

  const guiID = generateGUIID()
  const generation = ++s.generation
  s.ignoreCache = ignoreCache
  s.inFlight = true
  s.startedAt = Date.now()
  setDetails(
    s,
    produce(s.details, draft => {
      draft.guiID = guiID
      if (!draft.resetBrokeTrack) {
        draft.reason = ''
      }
      draft.state = 'checking'
    })
  )
  ignorePromise(runIdentify(s, generation, guiID, ignoreCache))
  ignorePromise(loadFollowers(s, generation))
  ignorePromise(loadFollowing(s, generation))
}

// Registered once for the lifetime of the module. The unsubscribes are dropped
// on purpose; sign out clears the engine listener registry wholesale and the
// flag below lets them be re-registered on the next load.
let engineSubscribed = false
const ensureEngineSubscriptions = () => {
  if (engineSubscribed) {
    return
  }
  engineSubscribed = true

  subscribeToEngineAction('keybase.1.identify3Ui.identify3Result', action => {
    const {guiID, result} = action.payload.params
    const s = sessionForGuiID(guiID)
    if (!s) {
      return
    }
    setDetails(s, updateTrackerDetailsResult(s.details, identifyResultToDetailsState(result)))
  })

  subscribeToEngineAction('keybase.1.identify3Ui.identify3UpdateRow', action => {
    const {row} = action.payload.params
    const s = sessionForGuiID(row.guiID)
    if (!s) {
      return
    }
    setDetails(s, updateTrackerDetailsRow(s.details, row))
  })

  subscribeToEngineAction('keybase.1.identify3Ui.identify3UserReset', action => {
    const s = sessionForGuiID(action.payload.params.guiID)
    if (!s) {
      return
    }
    setDetails(s, updateTrackerDetailsReset(s.details))
  })

  subscribeToEngineAction('keybase.1.identify3Ui.identify3UpdateUserCard', action => {
    const {guiID, card} = action.payload.params
    const s = sessionForGuiID(guiID)
    if (!s) {
      return
    }
    setDetails(s, updateTrackerDetailsUserCard(s.details, card))
    useUsersState.getState().dispatch.updates([{info: {fullname: card.fullName}, name: s.username}])
  })

  subscribeToEngineAction('keybase.1.identify3Ui.identify3Summary', action => {
    const {summary} = action.payload.params
    const s = sessionForGuiID(summary.guiID)
    if (!s) {
      return
    }
    setDetails(s, updateTrackerDetailsSummary(s.details, summary))
  })

  subscribeToEngineAction('keybase.1.NotifyTracking.notifyUserBlocked', action => {
    for (const s of [...sessions.values()]) {
      setDetails(s, updateTrackerDetailsBlocked(s.details, action.payload.params.b))
    }
  })

  subscribeToEngineAction('keybase.1.NotifyTracking.trackingChanged', action => {
    const s = sessions.get(action.payload.params.username)
    if (!s?.details.guiID) {
      return
    }
    loadProfileIdentify(s.username, {freshAfter: Date.now(), ignoreCache: true})
  })

  subscribeToEngineAction('keybase.1.NotifyUsers.userChanged', action => {
    const {uid, username} = useCurrentUserState.getState()
    if (!username || uid !== action.payload.params.uid || !sessions.has(username)) {
      return
    }
    loadProfileIdentify(username, {freshAfter: Date.now(), ignoreCache: false})
  })
}

export const subscribeToProfile = (username: string, cb: () => void) => {
  ensureSession(username)
  let subscribers = subscribersByUsername.get(username)
  if (!subscribers) {
    subscribers = new Set()
    subscribersByUsername.set(username, subscribers)
  }
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
    if (!subscribers.size) {
      subscribersByUsername.delete(username)
    }
    const s = sessions.get(username)
    if (s) {
      dropSessionIfIdle(s)
    }
  }
}

export const getProfileDetails = (username: string) => sessions.get(username)?.details
export const getProfileNonUserDetails = (username: string) => sessions.get(username)?.nonUserDetails

registerExternalResetter('tracker-identify-sessions', () => {
  sessions.clear()
  engineSubscribed = false
})
