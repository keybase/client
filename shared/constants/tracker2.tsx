import * as C from '@/constants'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import * as T from './types'
import {RPCError} from '@/util/errors'
import {mapGetEnsureValue} from '@/util/map'

export const noDetails: T.Tracker.Details = {
  assertions: new Map(),
  blocked: false,
  followers: undefined,
  followersCount: undefined,
  following: undefined,
  followingCount: undefined,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  resetBrokeTrack: false,
  state: 'unknown' as const,
  stellarHidden: false,
  teamShowcase: [],
  username: '',
  webOfTrustEntries: [],
}

export const noNonUserDetails: T.Tracker.NonUserDetails = {
  assertionKey: '',
  assertionValue: '',
  description: '',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: '',
}

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const noAssertion = Object.freeze<T.Tracker.Assertion>({
  assertionKey: '',
  belowFold: false,
  color: 'gray',
  kid: '',
  metas: [],
  pickerSubtext: '',
  pickerText: '',
  priority: -1,
  proofURL: '',
  sigID: '',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: '',
  state: 'error',
  timestamp: 0,
  type: '',
  value: '',
})

const rpcRowColorToColor = (color: T.RPCGen.Identify3RowColor): T.Tracker.AssertionColor => {
  switch (color) {
    case T.RPCGen.Identify3RowColor.blue:
      return 'blue'
    case T.RPCGen.Identify3RowColor.red:
      return 'red'
    case T.RPCGen.Identify3RowColor.black:
      return 'black'
    case T.RPCGen.Identify3RowColor.green:
      return 'green'
    case T.RPCGen.Identify3RowColor.gray:
      return 'gray'
    case T.RPCGen.Identify3RowColor.yellow:
      return 'yellow'
    case T.RPCGen.Identify3RowColor.orange:
      return 'orange'
  }
}

const rpcRowStateToAssertionState = (state: T.RPCGen.Identify3RowState): T.Tracker.AssertionState => {
  switch (state) {
    case T.RPCGen.Identify3RowState.checking:
      return 'checking'
    case T.RPCGen.Identify3RowState.valid:
      return 'valid'
    case T.RPCGen.Identify3RowState.error:
      return 'error'
    case T.RPCGen.Identify3RowState.warning:
      return 'warning'
    case T.RPCGen.Identify3RowState.revoked:
      return 'revoked'
  }
}

export const rpcAssertionToAssertion = (row: T.RPCGen.Identify3Row): T.Tracker.Assertion => ({
  ...noAssertion,
  assertionKey: `${row.key}:${row.value}`,
  color: rpcRowColorToColor(row.color),
  kid: row.kid || ',',
  metas: (row.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})),
  priority: row.priority,
  proofURL: row.proofURL,
  sigID: row.sigID,
  siteIcon: row.siteIcon || [],
  siteIconDarkmode: row.siteIconDarkmode || [],
  siteIconFull: row.siteIconFull || [],
  siteIconFullDarkmode: row.siteIconFullDarkmode || [],
  siteURL: row.siteURL,
  state: rpcRowStateToAssertionState(row.state),
  timestamp: row.ctime,
  type: row.key,
  value: row.value,
  wotProof: row.wotProof ?? undefined,
})

export const rpcSuggestionToAssertion = (s: T.RPCGen.ProofSuggestion): T.Tracker.Assertion => {
  const ourKey = s.key === 'web' ? 'dnsOrGenericWebSite' : s.key
  return {
    ...noAssertion,
    // we have a special case where we want to differentiate between a dns or web proof, so we have a special pseudo type we use
    assertionKey: ourKey,
    belowFold: s.belowFold,
    color: 'gray',
    metas: (s.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})),
    pickerSubtext: s.pickerSubtext,
    pickerText: s.pickerText,
    proofURL: '',
    siteIcon: s.profileIcon || [],
    siteIconDarkmode: s.profileIconDarkmode || [],
    siteIconFull: s.pickerIcon || [],
    siteIconFullDarkmode: s.pickerIconDarkmode || [],
    siteURL: '',
    state: 'suggestion',
    type: ourKey,
    value: s.profileText,
  }
}

const _scoreAssertionKey = (a: string) => {
  switch (a) {
    case 'pgp':
      return 110
    case 'twitter':
      return 100
    case 'facebook':
      return 90
    case 'github':
      return 80
    case 'reddit':
      return 75
    case 'hackernews':
      return 70
    case 'https':
      return 60
    case 'http':
      return 50
    case 'dns':
      return 40
    case 'stellar':
      return 30
    case 'btc':
      return 20
    case 'zcash':
      return 10
    default:
      return 1
  }
}
export const sortAssertionKeys = (a: string, b: string) => {
  const pa = a.split(':')
  const pb = b.split(':')

  const typeA = pa[0]
  const typeB = pb[0]

  if (typeA === typeB) {
    return pa[1]?.localeCompare(pb[1] ?? '') ?? 0
  }

  if (!typeA || !typeB) return 0

  const scoreA = _scoreAssertionKey(typeB)
  const scoreB = _scoreAssertionKey(typeA)
  return scoreA - scoreB
}

export const waitingKey = 'tracker2:waitingKey'
export const profileLoadWaitingKey = 'tracker2:profileLoad'
export const nonUserProfileLoadWaitingKey = 'tracker2:nonUserProfileLoad'

export const getDetails = (state: State, username: string): T.Tracker.Details =>
  state.usernameToDetails.get(username) || noDetails
export const getNonUserDetails = (state: State, username: string): T.Tracker.NonUserDetails =>
  state.usernameToNonUserDetails.get(username) || noNonUserDetails

export const guiIDToUsername = (state: State, guiID: string) => {
  const det = [...state.usernameToDetails.values()].find(d => d.guiID === guiID)
  return det ? det.username : null
}

// when suggestions are implemented, we'll probably want to show rejected entries if they have a suggestion
export const showableWotEntry = (entry: T.Tracker.WebOfTrustEntry): boolean =>
  entry.status === T.RPCGen.WotStatusType.accepted || entry.status === T.RPCGen.WotStatusType.proposed

export type Store = T.Immutable<{
  showTrackerSet: Set<string>
  usernameToDetails: Map<string, T.Tracker.Details>
  proofSuggestions: Array<T.Tracker.Assertion>
  usernameToNonUserDetails: Map<string, T.Tracker.NonUserDetails>
}>

const initialStore: Store = {
  proofSuggestions: [],
  showTrackerSet: new Set(),
  usernameToDetails: new Map(),
  usernameToNonUserDetails: new Map(),
}

export interface State extends Store {
  dispatch: {
    changeFollow: (guiID: string, follow: boolean) => void
    closeTracker: (guiID: string) => void
    getProofSuggestions: () => void
    ignore: (guiID: string) => void
    load: (p: {
      assertion: string
      forceDisplay?: boolean
      fromDaemon?: boolean
      guiID: string
      ignoreCache?: boolean
      reason: string
      inTracker: boolean
    }) => void
    loadNonUserProfile: (assertion: string) => void
    notifyCard: (guiID: string, card: T.RPCGen.UserCard) => void
    notifyReset: (guiID: string) => void
    notifyRow: (row: T.RPCGen.Identify3Row) => void
    notifySummary: (summary: T.RPCGen.Identify3Summary) => void
    notifyUserBlocked: (b: T.RPCGen.UserBlockedSummary) => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    replace: (usernameToDetails: Map<string, T.Tracker.Details>) => void
    resetState: 'default'
    showUser: (username: string, asTracker: boolean, skipNav?: boolean) => void
    updateResult: (guiID: string, result: T.Tracker.DetailsState, reason?: string) => void
  }
}

const rpcResultToStatus = (result: T.RPCGen.Identify3ResultType) => {
  switch (result) {
    case T.RPCGen.Identify3ResultType.ok:
      return 'valid'
    case T.RPCGen.Identify3ResultType.broken:
      return 'broken'
    case T.RPCGen.Identify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case T.RPCGen.Identify3ResultType.canceled:
      return 'error'
  }
}
export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    changeFollow: (guiID, follow) => {
      const f = async () => {
        try {
          await T.RPCGen.identify3Identify3FollowUserRpcPromise({follow, guiID}, waitingKey)
          get().dispatch.updateResult(guiID, 'valid', `Successfully ${follow ? 'followed' : 'unfollowed'}!`)
        } catch {
          get().dispatch.updateResult(guiID, 'error', `Failed to ${follow ? 'follow' : 'unfollow'}`)
        }
      }
      C.ignorePromise(f())
    },
    closeTracker: guiID => {
      set(s => {
        const username = guiIDToUsername(s, guiID)
        if (!username) {
          return
        }
        logger.info(`Closing tracker for assertion: ${username}`)
        s.showTrackerSet.delete(username)
      })
    },
    getProofSuggestions: () => {
      const f = async () => {
        try {
          const {suggestions} = await T.RPCGen.userProofSuggestionsRpcPromise(
            undefined,
            profileLoadWaitingKey
          )
          set(s => {
            s.proofSuggestions = T.castDraft(suggestions?.map(rpcSuggestionToAssertion)) ?? []
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error loading proof suggestions: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())
    },
    ignore: guiID => {
      const f = async () => {
        try {
          await T.RPCGen.identify3Identify3IgnoreUserRpcPromise({guiID}, waitingKey)
          get().dispatch.updateResult(guiID, 'valid', `Successfully ignored`)
        } catch {
          get().dispatch.updateResult(guiID, 'error', `Failed to ignore`)
        }
      }
      C.ignorePromise(f())
    },
    load: p => {
      const {guiID, forceDisplay, assertion, reason, ignoreCache = false, inTracker} = p
      set(s => {
        const username = assertion
        if (forceDisplay) {
          logger.info(`Showing tracker for assertion: ${assertion}`)
          s.showTrackerSet.add(username)
        }
        const d = mapGetEnsureValue(s.usernameToDetails, username, T.castDraft({...noDetails}))
        d.assertions = new Map() // just remove for now, maybe keep them
        d.guiID = guiID
        d.reason = reason
        d.state = 'checking'
        d.username = username
      })
      const f = async () => {
        if (p.fromDaemon) return
        const d = getDetails(get(), assertion)
        if (!d.guiID) {
          throw new Error('No guid on profile 2 load? ' + assertion || '')
        }
        try {
          await T.RPCGen.identify3Identify3RpcListener({
            incomingCallMap: {},
            params: {assertion, guiID, ignoreCache},
            waitingKey: profileLoadWaitingKey,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            if (error.code === T.RPCGen.StatusCode.scresolutionfailed) {
              get().dispatch.updateResult(guiID, 'notAUserYet')
            } else if (error.code === T.RPCGen.StatusCode.scnotfound) {
              // we're on the profile page for a user that does not exist. Currently the only way
              // to get here is with an invalid link or deeplink.
              C.useDeepLinksState
                .getState()
                .dispatch.setLinkError(
                  `You followed a profile link for a user (${assertion}) that does not exist.`
                )
              C.useRouterState.getState().dispatch.navigateUp()
              C.useRouterState.getState().dispatch.navigateAppend('keybaseLinkError')
            }
            // hooked into reloadable
            logger.error(`Error loading profile: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())

      const loadFollowers = async () => {
        if (inTracker) return
        try {
          const fs = await T.RPCGen.userListTrackersUnverifiedRpcPromise({assertion}, profileLoadWaitingKey)
          set(s => {
            const d = T.castDraft(getDetails(s, assertion))
            d.followers = new Set(fs.users?.map(f => f.username))
            d.followersCount = d.followers.size
          })
          if (fs.users) {
            C.useUsersState
              .getState()
              .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error loading follower info: ${error.message}`)
          }
        }
      }
      C.ignorePromise(loadFollowers())

      const loadFollowing = async () => {
        if (inTracker) return
        try {
          const fs = await T.RPCGen.userListTrackingRpcPromise({assertion, filter: ''}, profileLoadWaitingKey)
          set(s => {
            const d = T.castDraft(getDetails(s, assertion))
            d.following = new Set(fs.users?.map(f => f.username))
            d.followingCount = d.following.size
          })
          if (fs.users) {
            C.useUsersState
              .getState()
              .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error loading following info: ${error.message}`)
          }
        }
      }
      C.ignorePromise(loadFollowing())
    },
    loadNonUserProfile: assertion => {
      const f = async () => {
        try {
          const res = await T.RPCGen.userSearchGetNonUserDetailsRpcPromise(
            {assertion},
            nonUserProfileLoadWaitingKey
          )
          if (res.isNonUser) {
            const common = {
              assertion,
              assertionKey: res.assertionKey,
              assertionValue: res.assertionValue,
              description: res.description,
              siteIcon: res.siteIcon || [],
              siteIconDarkmode: res.siteIconDarkmode || [],
              siteIconFull: res.siteIconFull || [],
              siteIconFullDarkmode: res.siteIconFullDarkmode || [],
            }
            if (res.service) {
              const p = {
                ...common,
                ...res.service,
              }
              set(s => {
                const {assertion, ...rest} = p
                const {usernameToNonUserDetails} = s
                const old = usernameToNonUserDetails.get(assertion) ?? noNonUserDetails
                usernameToNonUserDetails.set(assertion, T.castDraft({...old, ...rest}))
              })
              return
            } else {
              const formatPhoneNumberInternational = (await import('@/util/phone-numbers'))
                .formatPhoneNumberInternational
              const formattedName =
                res.assertionKey === 'phone'
                  ? formatPhoneNumberInternational('+' + res.assertionValue)
                  : undefined
              const fullName = res.contact ? res.contact.contactName : ''
              const p = {...common, formattedName, fullName}
              set(s => {
                const {assertion, ...rest} = p
                const {usernameToNonUserDetails} = s
                const old = usernameToNonUserDetails.get(assertion) ?? noNonUserDetails
                usernameToNonUserDetails.set(assertion, T.castDraft({...old, ...rest}))
              })
            }
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(`Error loading non user profile: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())
    },
    notifyCard: (guiID, card) => {
      const username = guiIDToUsername(get(), guiID)
      set(s => {
        if (!username) return
        const {bio, blocked, fullName, hidFromFollowers, location, stellarHidden, teamShowcase} = card
        const {unverifiedNumFollowers, unverifiedNumFollowing} = card
        const d = T.castDraft(getDetails(s, username))
        d.bio = bio
        d.blocked = blocked
        // These will be overridden by a later updateFollows, if it happens (will
        // happen when viewing profile, but not in tracker pop up.
        d.followersCount = unverifiedNumFollowers
        d.followingCount = unverifiedNumFollowing
        d.fullname = fullName
        d.location = location
        d.stellarHidden = stellarHidden
        d.teamShowcase = T.castDraft(
          teamShowcase?.map(t => ({
            description: t.description,
            isOpen: t.open,
            membersCount: t.numMembers,
            name: t.fqName,
            publicAdmins: t.publicAdmins ?? [],
          })) ?? []
        )
        d.hidFromFollowers = hidFromFollowers
      })
      username &&
        C.useUsersState.getState().dispatch.updates([{info: {fullname: card.fullName}, name: username}])
    },
    notifyReset: guiID => {
      set(s => {
        const username = guiIDToUsername(s, guiID)
        if (!username) return
        const d = T.castDraft(getDetails(s, username))
        d.resetBrokeTrack = true
        d.reason = `${username} reset their account since you last followed them.`
      })
    },
    notifyRow: row => {
      set(s => {
        const {guiID} = row
        const username = guiIDToUsername(s, guiID)
        if (!username) return
        const d = T.castDraft(getDetails(s, username))
        const assertions = d.assertions ?? new Map()
        d.assertions = assertions
        const assertion = rpcAssertionToAssertion(row)
        assertions.set(assertion.assertionKey, assertion)
      })
    },
    notifySummary: summary => {
      set(s => {
        const {numProofsToCheck, guiID} = summary
        const username = guiIDToUsername(s, guiID)
        if (!username) return
        const d = T.castDraft(getDetails(s, username))
        d.numAssertionsExpected = numProofsToCheck
      })
    },
    notifyUserBlocked: b => {
      set(s => {
        const {blocker, blocks} = b
        const d = T.castDraft(getDetails(s, blocker))
        const toProcess = Object.entries(blocks ?? {}).map(
          ([username, userBlocks]) =>
            [username, T.castDraft(getDetails(s, username)), userBlocks || []] as const
        )
        toProcess.forEach(([username, det, userBlocks]) => {
          userBlocks.forEach(blockState => {
            if (blockState.blockType === T.RPCGen.UserBlockType.chat) {
              det.blocked = blockState.blocked
            } else {
              det.hidFromFollowers = blockState.blocked
              blockState.blocked && d.followers?.delete(username)
            }
          })
        })
        d.followersCount = d.followers?.size
      })
    },
    onEngineConnected: () => {
      const f = async () => {
        try {
          await T.RPCGen.delegateUiCtlRegisterIdentify3UIRpcPromise()
          logger.info('Registered identify ui')
        } catch (error) {
          logger.warn('error in registering identify ui: ', error)
        }
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyTrackingTrackingChanged: {
          // only refresh if we have tracked them before
          const {username} = action.payload.params
          if (get().usernameToDetails.get(username)) {
            get().dispatch.load({
              assertion: username,
              fromDaemon: false,
              guiID: generateGUIID(),
              ignoreCache: true,
              inTracker: false,
              reason: '',
            })
          }
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3Result: {
          const {guiID, result} = action.payload.params
          get().dispatch.updateResult(guiID, rpcResultToStatus(result))
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3ShowTracker: {
          const {assertion, forceDisplay = false, guiID, reason} = action.payload.params
          get().dispatch.load({
            assertion,
            forceDisplay,
            fromDaemon: true,
            guiID,
            ignoreCache: false,
            inTracker: true,
            reason: reason.reason,
          })
          break
        }
        // if we mutated somehow reload ourselves and reget the suggestions
        case EngineGen.keybase1NotifyUsersUserChanged: {
          if (C.useCurrentUserState.getState().uid !== action.payload.params.uid) {
            return
          }
          get().dispatch.load({
            assertion: C.useCurrentUserState.getState().username,
            forceDisplay: false,
            fromDaemon: false,
            guiID: generateGUIID(),
            ignoreCache: false,
            inTracker: false,
            reason: '',
          })
          get().dispatch.getProofSuggestions()
          break
        }
        // This allows the server to send us a notification to *remove* (not add)
        // arbitrary followers from arbitrary tracker2 results, so we can hide
        // blocked users from follower lists.
        case EngineGen.keybase1NotifyTrackingNotifyUserBlocked: {
          get().dispatch.notifyUserBlocked(action.payload.params.b)
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3UpdateRow: {
          const {row} = action.payload.params
          get().dispatch.notifyRow(row)
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3UserReset: {
          const {guiID} = action.payload.params
          get().dispatch.notifyReset(guiID)
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3UpdateUserCard: {
          const {guiID, card} = action.payload.params
          get().dispatch.notifyCard(guiID, card)
          break
        }
        case EngineGen.keybase1Identify3UiIdentify3Summary: {
          const {summary} = action.payload.params
          get().dispatch.notifySummary(summary)
          break
        }
        default:
      }
    },
    replace: usernameToDetails => {
      set(s => {
        s.usernameToDetails = T.castDraft(usernameToDetails)
      })
    },
    resetState: 'default',
    showUser: (username, asTracker, skipNav) => {
      get().dispatch.load({
        assertion: username,
        // with new nav we never show trackers from inside the app
        forceDisplay: false,
        fromDaemon: false,
        guiID: generateGUIID(),
        ignoreCache: true,
        inTracker: asTracker,
        reason: '',
      })
      if (!skipNav) {
        // go to profile page
        C.useProfileState.getState().dispatch.showUserProfile(username)
      }
    },
    updateResult: (guiID, result, reason) => {
      set(s => {
        const username = guiIDToUsername(s, guiID)
        if (!username) return
        const newReason =
          reason ||
          (result === 'broken' && `Some of ${username}'s proofs have changed since you last followed them.`)
        const d = T.castDraft(getDetails(s, username))
        // Don't overwrite the old reason if the user reset.
        if (!d.resetBrokeTrack || d.reason.length === 0) {
          d.reason = newReason || d.reason
        }
        if (result === 'valid') {
          d.resetBrokeTrack = false
        }
        d.state = result
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
