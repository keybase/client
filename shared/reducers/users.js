// @flow
import * as UsersGen from '../actions/users-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as Constants from '../constants/users'
import * as Types from '../constants/types/users'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()
const blankUserInfo = Constants.makeUserInfo()

type Actions =
  | UsersGen.Actions
  | TrackerGen.UpdateUserInfoPayload
  | Tracker2Gen.UpdateFollowersPayload
  | Tracker2Gen.UpdatedDetailsPayload

const reducer = (state: Types.State = initialState, action: Actions): Types.State => {
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
            // only make it if one exists already
            m.update(user, info => (info ? info.set('broken', false) : info))
          })
          newlyBroken.forEach(user => {
            m.update(user, info => (info || blankUserInfo).set('broken', true))
          })
        })
      )
    }
    case TrackerGen.updateUserInfo:
      return state.updateIn(['infoMap', action.payload.username], (userInfo = blankUserInfo) =>
        userInfo.set('fullname', action.payload.userCard.fullName)
      )
    case Tracker2Gen.updatedDetails:
      return state.updateIn(['infoMap', action.payload.username], (userInfo = blankUserInfo) =>
        userInfo.set('fullname', action.payload.fullname)
      )
    case Tracker2Gen.updateFollowers: {
      return state.update('infoMap', map =>
        map.withMutations(m => {
          const all = [...action.payload.followers, ...action.payload.following]
          all.forEach(({username, fullname}) => {
            m.update(username, old => (old || blankUserInfo).merge({fullname}))
          })
        })
      )
    }
    // Saga only actions
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default reducer
