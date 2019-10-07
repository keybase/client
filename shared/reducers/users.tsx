import * as UsersGen from '../actions/users-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Constants from '../constants/users'
import * as Types from '../constants/types/users'
import * as ConfigGen from '../actions/config-gen'

const initialState: Types.State = Constants.makeState()
const blankUserInfo = Constants.makeUserInfo()

type Actions =
  | UsersGen.Actions
  | Tracker2Gen.UpdateFollowersPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | ConfigGen.SetAccountsPayload
  | TeamBuildingGen.SearchResultsLoadedPayload

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
    case UsersGen.updateBio: {
      return state.updateIn(
        ['infoMap', action.payload.username],
        (userInfo = blankUserInfo) => userInfo.set('bio', action.payload.userCard.bioDecorated) // using bioDecorated to make links clickable and shruggies whole
      )
    }
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
    case ConfigGen.setAccounts:
      return state.update('infoMap', map =>
        map.withMutations(m => {
          action.payload.configuredAccounts.forEach(({username, fullname}) => {
            m.update(username, old => (old || blankUserInfo).merge({fullname}))
          })
        })
      )
    case TeamBuildingGen.searchResultsLoaded:
      return state.update('infoMap', map =>
        map.withMutations(m => {
          action.payload.users.forEach(({serviceMap, prettyName}) => {
            const kbName = serviceMap.keybase
            if (kbName) {
              // only if unknown
              if (!m.getIn([kbName, 'fullname'])) {
                m.update(kbName, old => (old || blankUserInfo).merge({fullname: prettyName}))
              }
            }
          })
        })
      )

    // Saga only actions
    default:
      return state
  }
}

export default reducer
