import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Container from '../util/container'
import logger from '../logger'

const initialState: Types.State = Constants.makeState()

function actionToUsername<A extends {payload: {guiID: string}}>(state: Types.State, action: A) {
  const {guiID} = action.payload
  return Constants.guiIDToUsername(state, guiID)
}

const cloneMapGetItem = (state: Types.State, username: string) => {
  const usernameToDetails = new Map(state.usernameToDetails)
  const old = usernameToDetails.get(username) || Constants.noDetails
  return {old, usernameToDetails}
}

export default Container.makeReducer<
  Tracker2Gen.Actions | ConfigGen.BootstrapStatusLoadedPayload,
  Types.State
>(initialState, {
  [Tracker2Gen.resetStore]: () => initialState,
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
    const {username, fullname} = action.payload
    const usernameToDetails = new Map(draftState.usernameToDetails)
    const old = usernameToDetails.get(username) || Constants.noDetails
    usernameToDetails.set(username, {
      ...old,
      fullname,
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.load]: (draftState, action) => {
    const {guiID, forceDisplay, assertion, reason} = action.payload
    const username = assertion
    if (forceDisplay) {
      logger.info(`Showing tracker for assertion: ${assertion}`)
    }
    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    usernameToDetails.set(username, {
      ...old,
      assertions: new Map(), // just remove for now, maybe keep them
      guiID,
      reason,
      showTracker: forceDisplay || old.showTracker, // show it or keep the last state
      state: 'checking',
      username,
    })
    draftState.usernameToDetails = usernameToDetails
  },

  [Tracker2Gen.updatedDetails]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return
    const {
      bio,
      blocked,
      followersCount,
      followingCount,
      fullname,
      location,
      registeredForAirdrop,
      teamShowcase,
    } = action.payload
    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    usernameToDetails.set(username, {
      ...old,
      bio,
      blocked,
      followersCount,
      followingCount,
      fullname,
      location,
      registeredForAirdrop,
      teamShowcase,
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.updateResult]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return

    const {reason, result} = action.payload
    const newReason =
      reason ||
      (result === 'broken' && `Some of ${username}'s proofs have changed since you last followed them.`)

    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    usernameToDetails.set(username, {
      ...old,
      reason: newReason || old.reason,
      state: result,
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.closeTracker]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return

    logger.info(`Closing tracker for assertion: ${username}`)

    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    usernameToDetails.set(username, {
      ...old,
      showTracker: false,
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.updateAssertion]: (draftState, action) => {
    const username = actionToUsername(draftState, action)
    if (!username) return
    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    const {assertion} = action.payload
    const assertions = new Map(old.assertions || [])
    assertions.set(assertion.assertionKey, assertion)
    usernameToDetails.set(username, {
      ...old,
      assertions,
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.updateFollowers]: (draftState, action) => {
    const {username, followers, following} = action.payload
    const {usernameToDetails, old} = cloneMapGetItem(draftState, username)
    usernameToDetails.set(username, {
      ...old,
      followers: new Set(followers.map(f => f.username)),
      following: new Set(following.map(f => f.username)),
    })
    draftState.usernameToDetails = usernameToDetails
  },
  [Tracker2Gen.proofSuggestionsUpdated]: (draftState, action) => {
    type ReadonlyProofSuggestions = Readonly<Types.State['proofSuggestions']>
    ;(draftState.proofSuggestions as ReadonlyProofSuggestions) = action.payload.suggestions
  },
  [Tracker2Gen.loadedNonUserProfile]: (draftState, action) => {
    const {assertion, ...rest} = action.payload
    const usernameToNonUserDetails = new Map(draftState.usernameToNonUserDetails)
    const old = usernameToNonUserDetails.get(assertion) || Constants.noNonUserDetails
    usernameToNonUserDetails.set(assertion, {
      ...old,
      ...rest,
    })
    draftState.usernameToNonUserDetails = usernameToNonUserDetails
  },
})
