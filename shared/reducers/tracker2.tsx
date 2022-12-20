import * as Constants from '../constants/tracker2'
import type * as Types from '../constants/types/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Container from '../util/container'
import * as EngineGen from '../actions/engine-gen-gen'
import * as RpcTypes from '../constants/types/rpc-gen'
import {mapGetEnsureValue} from '../util/map'
import logger from '../logger'

const initialState: Types.State = Constants.makeState()

const getDetails = (state: Types.State, username: string) =>
  mapGetEnsureValue(state.usernameToDetails, username, {...Constants.noDetails})

type Actions =
  | Tracker2Gen.Actions
  | ConfigGen.BootstrapStatusLoadedPayload
  | EngineGen.Keybase1NotifyTrackingNotifyUserBlockedPayload
  | EngineGen.Keybase1Identify3UiIdentify3UpdateRowPayload
  | EngineGen.Keybase1Identify3UiIdentify3UserResetPayload
  | EngineGen.Keybase1Identify3UiIdentify3UpdateUserCardPayload
  | EngineGen.Keybase1Identify3UiIdentify3SummaryPayload

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [Tracker2Gen.resetStore]: () => initialState,
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
    const {username, fullname} = action.payload
    getDetails(draftState, username).fullname = fullname
  },
  [Tracker2Gen.load]: (draftState, action) => {
    const {guiID, forceDisplay, assertion, reason} = action.payload
    const username = assertion
    if (forceDisplay) {
      logger.info(`Showing tracker for assertion: ${assertion}`)
      draftState.showTrackerSet.add(username)
    }
    const d = getDetails(draftState, username)
    d.assertions = new Map() // just remove for now, maybe keep them
    d.guiID = guiID
    d.reason = reason
    d.state = 'checking'
    d.username = username
  },
  [Tracker2Gen.updateResult]: (draftState, action) => {
    const {guiID} = action.payload
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    const {reason, result} = action.payload
    const newReason =
      reason ||
      (result === 'broken' && `Some of ${username}'s proofs have changed since you last followed them.`)

    const d = getDetails(draftState, username)
    // Don't overwrite the old reason if the user reset.
    if (!d.resetBrokeTrack || d.reason.length === 0) {
      d.reason = newReason || d.reason
    }
    if (result === 'valid') {
      d.resetBrokeTrack = false
    }
    d.state = result
  },
  [Tracker2Gen.closeTracker]: (draftState, action) => {
    const {guiID} = action.payload
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    logger.info(`Closing tracker for assertion: ${username}`)
    draftState.showTrackerSet.delete(username)
  },
  [Tracker2Gen.updateFollows]: (draftState, action) => {
    const {username, followers, following} = action.payload
    const d = getDetails(draftState, username)
    if (followers) {
      d.followers = new Set(followers.map(f => f.username))
      d.followersCount = d.followers.size
    }
    if (following) {
      d.following = new Set(following.map(f => f.username))
      d.followingCount = d.following.size
    }
  },
  [Tracker2Gen.updateWotEntries]: (draftState, action) => {
    const d = getDetails(draftState, action.payload.voucheeUsername)
    d.webOfTrustEntries = action.payload.entries
  },
  [Tracker2Gen.proofSuggestionsUpdated]: (draftState, action) => {
    draftState.proofSuggestions = Container.castDraft(action.payload.suggestions)
  },
  [Tracker2Gen.loadedNonUserProfile]: (draftState, action) => {
    const {assertion, ...rest} = action.payload
    const {usernameToNonUserDetails} = draftState
    const old = usernameToNonUserDetails.get(assertion) || Constants.noNonUserDetails
    usernameToNonUserDetails.set(assertion, {
      ...old,
      ...rest,
    })
  },
  // This allows the server to send us a notification to *remove* (not add)
  // arbitrary followers from arbitrary tracker2 results, so we can hide
  // blocked users from follower lists.
  [EngineGen.keybase1NotifyTrackingNotifyUserBlocked]: (draftState, action) => {
    const {blocker, blocks} = action.payload.params.b
    const d = getDetails(draftState, blocker)
    const toProcess = Object.entries(blocks ?? {}).map(
      ([username, userBlocks]) => [username, getDetails(draftState, username), userBlocks || []] as const
    )
    toProcess.forEach(([username, det, userBlocks]) => {
      userBlocks.forEach(blockState => {
        if (blockState.blockType === RpcTypes.UserBlockType.chat) {
          det.blocked = blockState.blocked
        } else if (blockState.blockType === RpcTypes.UserBlockType.follow) {
          det.hidFromFollowers = blockState.blocked
          blockState.blocked && d.followers && d.followers.delete(username)
        }
      })
    })
    d.followersCount = d.followers?.size
  },
  [EngineGen.keybase1Identify3UiIdentify3UpdateRow]: (draftState, action) => {
    const {row} = action.payload.params
    const {guiID} = row
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    const d = getDetails(draftState, username)
    const assertions = d.assertions ?? new Map()
    d.assertions = assertions
    const assertion = Constants.rpcAssertionToAssertion(row)
    assertions.set(assertion.assertionKey, assertion)
  },
  [EngineGen.keybase1Identify3UiIdentify3UserReset]: (draftState, action) => {
    const {guiID} = action.payload.params
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    const d = getDetails(draftState, username)
    d.resetBrokeTrack = true
    d.reason = `${username} reset their account since you last followed them.`
  },
  [EngineGen.keybase1Identify3UiIdentify3UpdateUserCard]: (draftState, action) => {
    const {guiID, card} = action.payload.params
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    const {bio, blocked, fullName, hidFromFollowers, location, stellarHidden, teamShowcase} = card
    const {unverifiedNumFollowers, unverifiedNumFollowing} = card
    const d = getDetails(draftState, username)
    d.bio = bio
    d.blocked = blocked
    // These will be overridden by a later updateFollows, if it happens (will
    // happen when viewing profile, but not in tracker pop up.
    d.followersCount = unverifiedNumFollowers
    d.followingCount = unverifiedNumFollowing
    d.fullname = fullName
    d.location = location
    d.stellarHidden = stellarHidden
    d.teamShowcase =
      teamShowcase?.map(t => ({
        description: t.description,
        isOpen: t.open,
        membersCount: t.numMembers,
        name: t.fqName,
        publicAdmins: t.publicAdmins ?? [],
      })) ?? []
    d.hidFromFollowers = hidFromFollowers
  },
  [EngineGen.keybase1Identify3UiIdentify3Summary]: (draftState, action) => {
    const {summary} = action.payload.params
    const {numProofsToCheck, guiID} = summary
    const username = Constants.guiIDToUsername(draftState, guiID)
    if (!username) {
      return
    }

    const d = getDetails(draftState, username)
    d.numAssertionsExpected = numProofsToCheck
  },
})
