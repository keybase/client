// @flow
import * as UsersGen from '../actions/users-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as Constants from '../constants/users'
import * as Types from '../constants/types/users'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()
const blankUserInfo = Constants.makeUserInfo()

const reducer = (
  state: Types.State = initialState,
  action: UsersGen.Actions | TrackerGen.UpdateUserInfoPayload | Tracker2Gen.UpdateFollowersPayload
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
            // only make it if one exists already
            m.update(user, info => (info ? info.set('broken', false) : info))
          })
          newlyBroken.forEach(user => {
            m.update(user, info => (info || blankUserInfo).set('broken', true))
          })
        })
      )
    }
    // maybe plumb through updatedetails
    case TrackerGen.updateUserInfo: {
      return state.updateIn(['infoMap', action.payload.username], (userInfo = blankUserInfo) =>
        userInfo.set('fullname', action.payload.userCard.fullName)
      )
    }

    case Tracker2Gen.updateFollowers: {
      const updates = [...action.payload.followers, ...action.payload.following].reduce((map, f) => {
        map[f.username] = {fullname: f.fullname}
        return map
      }, {})

      return state.updateIn(['infoMap'], infoMap => infoMap.mergeDeep(updates))
    }
    // Saga only actions
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default reducer
