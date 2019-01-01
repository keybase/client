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
    case Profile2Gen.load:
      const guiID = action.payload.guiID || Constants.generateGUIID()
      return state.merge({
        usernameToDetails: state.usernameToDetails.merge({
          [action.payload.assertion]: {
            assertions: I.Map(), // just remove for now, maybe keep them
            guiID,
            showTracker: action.payload.forceDisplay,
            state: 'checking',
            username: action.payload.assertion,
          },
        }),
      })
    case Profile2Gen.updatedDetails:
      const username = guiIDToUsername(state, action.payload.guiID)
      if (!username) {
        return state
      }
      return state.merge({
        usernameToDetails: state.usernameToDetails.merge({
          [username]: {
            bio: action.payload.bio,
            followThem: action.payload.followThem,
            followersCount: action.payload.followersCount,
            followingCount: action.payload.followingCount,
            followsYou: action.payload.followsYou,
            fullname: action.payload.fullname,
            location: action.payload.location,
            publishedTeams: action.payload.publishedTeams,
          },
        }),
      })
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
