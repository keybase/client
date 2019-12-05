import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Container from '../util/container'
import * as EngineGen from '../actions/engine-gen-gen'
import * as RpcTypes from '../constants/types/rpc-gen'
import {mapGetEnsureValue} from '../util/map'
import logger from '../logger'

const initialState: Types.State = Constants.makeState()

function actionToUsername<A extends {payload: {guiID: string}}>(state: Types.State, action: A) {
  const {guiID} = action.payload
  return Constants.guiIDToUsername(state, guiID)
}

const getDetails = (state: Types.State, username: string) =>
  mapGetEnsureValue(state.usernameToDetails, username, {...Constants.noDetails})

type Actions =
  | Tracker2Gen.Actions
  | ConfigGen.BootstrapStatusLoadedPayload
  | EngineGen.Keybase1NotifyTrackingNotifyUserBlockedPayload

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
    }
    const d = getDetails(draftState, username)
    d.assertions = new Map() // just remove for now, maybe keep them
    d.guiID = guiID
    d.reason = reason
    d.showTracker = forceDisplay || d.showTracker // show it or keep the last state
    d.state = 'checking'
    d.username = username
  },
  [Tracker2Gen.updatedDetails]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return
    const d = getDetails(draftState, username)
    d.bio = action.payload.bio
    d.blocked = action.payload.blocked
    d.followersCount = action.payload.followersCount
    d.followingCount = action.payload.followingCount
    d.fullname = action.payload.fullname
    d.location = action.payload.location
    d.registeredForAirdrop = action.payload.registeredForAirdrop
    d.teamShowcase = action.payload.teamShowcase
    d.hidFromFollowers = action.payload.hidFromFollowers
  },
  [Tracker2Gen.updateResult]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return

    const {reason, result} = action.payload
    const newReason =
      reason ||
      (result === 'broken' && `Some of ${username}'s proofs have changed since you last followed them.`)

    const d = getDetails(draftState, username)
    d.reason = newReason || d.reason
    d.state = result
  },
  [Tracker2Gen.closeTracker]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return

    logger.info(`Closing tracker for assertion: ${username}`)

    const d = getDetails(draftState, username)
    d.showTracker = false
  },
  [Tracker2Gen.updateAssertion]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return
    const d = getDetails(draftState, username)
    const {assertion} = action.payload
    const assertions = d.assertions || new Map()
    d.assertions = assertions
    assertions.set(assertion.assertionKey, assertion)
  },
  [Tracker2Gen.updateFollowers]: (draftState, action) => {
    const {username, followers, following} = action.payload
    const d = getDetails(draftState, username)
    d.followers = new Set(followers.map(f => f.username))
    d.following = new Set(following.map(f => f.username))
    d.followersCount = d.followers.size
    d.followingCount = d.following.size
  },
  [Tracker2Gen.proofSuggestionsUpdated]: (draftState, action) => {
    type ReadonlyProofSuggestions = Readonly<Types.State['proofSuggestions']>
    ;(draftState.proofSuggestions as ReadonlyProofSuggestions) = action.payload.suggestions
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
})
