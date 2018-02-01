// @flow
import * as UsersGen from '../actions/users-gen'
import * as Constants from '../constants/users'
import * as Types from '../constants/types/users'

const initialState: Types.State = Constants.makeState()
const blankUserInfo = Constants.makeUserInfo()

const reducer = (state: Types.State = initialState, action: UsersGen.Actions): Types.State => {
  switch (action.type) {
    case UsersGen.resetStore:
      return initialState
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
    // Saga only actions
    //
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default reducer
