// @flow
import * as I from 'immutable'
import * as Constants from '../constants/profile2'
import * as Types from '../constants/types/profile2'
import * as Profile2Gen from '../actions/profile2-gen'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()

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
            state: 'checking',
          },
        }),
      })
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
