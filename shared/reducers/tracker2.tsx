import * as I from 'immutable'
import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import logger from '../logger'

const initialState: Types.State = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: Tracker2Gen.Actions | ConfigGen.BootstrapStatusLoadedPayload
): Types.State {
  switch (action.type) {
    case ConfigGen.bootstrapStatusLoaded: {
      const {username} = action.payload
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.merge({fullname: action.payload.fullname})
        ),
      })
    }
    case Tracker2Gen.resetStore:
      return initialState
    case Tracker2Gen.load: {
      const guiID = action.payload.guiID
      if (action.payload.forceDisplay) {
        logger.info(`Showing tracker for assertion: ${action.payload.assertion}`)
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn(
          [action.payload.assertion],
          (old = Constants.makeDetails()) =>
            old.merge({
              assertions: I.Map(), // just remove for now, maybe keep them
              guiID,
              reason: action.payload.reason,
              showTracker: action.payload.forceDisplay || old.showTracker, // show it or keep the last state
              state: 'checking',
              username: action.payload.assertion,
            })
        ),
      })
    }
    case Tracker2Gen.updatedDetails: {
      const username = Constants.guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.merge({
            bio: action.payload.bio,
            blocked: action.payload.blocked,
            followersCount: action.payload.followersCount,
            followingCount: action.payload.followingCount,
            fullname: action.payload.fullname,
            location: action.payload.location,
            registeredForAirdrop: action.payload.registeredForAirdrop,
            teamShowcase: I.List(action.payload.teamShowcase.map(Constants.makeTeamShowcase)),
          })
        ),
      })
    }
    case Tracker2Gen.updateResult: {
      const username = Constants.guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }

      const reason =
        action.payload.reason ||
        (action.payload.result === 'broken' &&
          `Some of ${username}'s proofs have changed since you last followed them`)

      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.merge({
            reason: reason || old.reason,
            state: action.payload.result,
          })
        ),
      })
    }
    case Tracker2Gen.closeTracker: {
      const username = Constants.guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      logger.info(`Closing tracker for assertion: ${username}`)
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.merge({showTracker: false})
        ),
      })
    }
    case Tracker2Gen.updateAssertion: {
      const username = Constants.guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.updateIn(
            ['assertions', action.payload.assertion.assertionKey],
            (old = Constants.makeAssertion()) => old.merge(action.payload.assertion)
          )
        ),
      })
    }

    case Tracker2Gen.updateFollowers:
      const convert = f => f.username
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn(
          [action.payload.username],
          (old = Constants.makeDetails()) =>
            old.merge({
              followers: I.OrderedSet(action.payload.followers.map(convert)),
              following: I.OrderedSet(action.payload.following.map(convert)),
            })
        ),
      })
    case Tracker2Gen.proofSuggestionsUpdated:
      return state.merge({proofSuggestions: I.List(action.payload.suggestions)})
    // Saga only actions
    case Tracker2Gen.getProofSuggestions:
    case Tracker2Gen.changeFollow:
    case Tracker2Gen.showUser:
    case Tracker2Gen.ignore:
      return state
    default:
      return state
  }
}
