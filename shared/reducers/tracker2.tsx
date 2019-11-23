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

const getDetails = (state: Types.State, username: string) => {
  const {usernameToDetails} = state
  const d = usernameToDetails.get(username) || {...Constants.noDetails}
  usernameToDetails.set(username, d)
  return d
}

type Actions = Tracker2Gen.Actions | ConfigGen.BootstrapStatusLoadedPayload

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
    const {bio, blocked, followersCount, followingCount, fullname} = action.payload
    const {location, registeredForAirdrop, teamShowcase} = action.payload
    const d = getDetails(draftState, username)
    d.bio = bio
    d.blocked = blocked
    d.followersCount = followersCount
    d.followingCount = followingCount
    d.fullname = fullname
    d.location = location
    d.registeredForAirdrop = registeredForAirdrop
    d.teamShowcase = teamShowcase
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
  [Tracker2Gen.userBlocked]: (draftState, action) => {
    const {blocker, blocked} = action.payload
    const d = getDetails(draftState, blocker)
    const followers = d.followers || new Set()
    blocked.forEach(e => {
      followers.delete(e)
    })
    d.followers = followers
    d.followersCount = followers.size
  },
})
