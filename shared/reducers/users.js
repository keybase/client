// @flow
import * as UsersGen from '../actions/users-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as Constants from '../constants/users'
import * as Types from '../constants/types/users'

const initialState: Types.State = Constants.makeState()
const blankUserInfo = Constants.makeUserInfo()

const reducer = (
  state: Types.State = initialState,
  action: UsersGen.Actions | TrackerGen.UpdateUserInfoPayload
): Types.State => {
  switch (action.type) {
    case UsersGen.resetStore:
      return initialState
    case UsersGen.updateFullnames: {
      return state.update('infoMap', map =>
        map.withMutations(m => {
          Object.keys(action.payload.usernameToFullname).forEach(username => {
            m.update(username, info =>
              (info || blankUserInfo).set('fullname', action.payload.usernameToFullname[username])
            )
          })
        })
      )
    }
    case UsersGen.updateBrokenState: {
      const {newlyBroken, newlyFixed} = action.payload

      return state.update('infoMap', map =>
        map.withMutations(m => {
          newlyFixed.forEach(user => {
            m.update(user, info => (info || blankUserInfo).set('broken', false))
          })
          newlyBroken.forEach(user => {
            m.update(user, info => (info || blankUserInfo).set('broken', true))
          })
        })
      )
    }
    case TrackerGen.updateUserInfo: {
      return state.updateIn(['infoMap', action.payload.username], (userInfo = blankUserInfo) =>
        userInfo.set('fullname', action.payload.userCard.fullName)
      )
    }
    // Saga only actions
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

export default reducer
