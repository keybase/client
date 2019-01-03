// @flow
import * as I from 'immutable'
import * as Constants from '../constants/profile2'
import * as Types from '../constants/types/profile2'
import * as Profile2Gen from '../actions/profile2-gen'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()

const guiIDToUsername = (state, guiID) => {
  const d = state.usernameToDetails.find(d => d.guiID === guiID)
  return d ? d.username : null
}

export default function(state: Types.State = initialState, action: Profile2Gen.Actions): Types.State {
  switch (action.type) {
    case Profile2Gen.resetStore:
      return initialState
    case Profile2Gen.load: {
      const guiID = action.payload.guiID || Constants.generateGUIID()
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([action.payload.assertion], old =>
          (old || Constants.makeDetails()).merge({
            assertions: I.Map(), // just remove for now, maybe keep them
            guiID,
            reason: action.payload.reason,
            showTracker: action.payload.forceDisplay,
            state: 'checking',
            username: action.payload.assertion,
          })
        ),
      })
    }
    case Profile2Gen.updatedDetails: {
      const username = guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], old =>
          (old || Constants.makeDetails()).merge({
            bio: action.payload.bio,
            followersCount: action.payload.followersCount,
            followingCount: action.payload.followingCount,
            fullname: action.payload.fullname,
            location: action.payload.location,
            publishedTeams: action.payload.publishedTeams,
          })
        ),
      })
    }
    case Profile2Gen.updateResult: {
      const username = guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }

      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], old =>
          (old || Constants.makeDetails()).merge({
            reason:
              action.payload.result === 'error'
                ? action.payload.reason ||
                  `Some of ${username}'s proofs have changed since you last followed them`
                : old.reason,
            state: action.payload.result,
          })
        ),
      })
    }
    case Profile2Gen.closeTracker: {
      const username = guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], old =>
          (old || Constants.makeDetails()).merge({
            showTracker: false,
          })
        ),
      })
    }
    case Profile2Gen.updateAssertion: {
      const username = guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      const assertionKey = `${action.payload.type}:${action.payload.value}`
      return state.merge({
        usernameToDetails: state.usernameToDetails.updateIn([username], old =>
          (old || Constants.makeDetails()).updateIn(['assertions', assertionKey], old =>
            (old || Constants.makeAssertion()).merge({
              assertionKey,
              color: action.payload.color,
              metas: action.payload.metas.map(Constants.makeMeta),
              proofURL: action.payload.proofURL,
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
    // Saga only actions
    case Profile2Gen.changeFollow:
    case Profile2Gen.ignore:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
