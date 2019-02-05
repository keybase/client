// @flow
import * as I from 'immutable'
import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: Tracker2Gen.Actions): Types.State {
  switch (action.type) {
    case Tracker2Gen.resetStore:
      return initialState
    case Tracker2Gen.load: {
      const guiID = action.payload.guiID
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
            followersCount: action.payload.followersCount,
            followingCount: action.payload.followingCount,
            fullname: action.payload.fullname,
            location: action.payload.location,
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
      const assertionKey = `${action.payload.type}:${action.payload.value}`
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], (old = Constants.makeDetails()) =>
          old.updateIn(['assertions', assertionKey], (old = Constants.makeAssertion()) =>
            old.merge({
              assertionKey,
              color: action.payload.color,
              metas: action.payload.metas.map(Constants.makeMeta),
              proofURL: action.payload.proofURL,
              sigID: action.payload.sigID,
              siteIcon: action.payload.siteIcon,
              siteURL: action.payload.siteURL,
              state: action.payload.state,
              type: action.payload.type,
              value: action.payload.value,
            })
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
    case Tracker2Gen.ignore:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
