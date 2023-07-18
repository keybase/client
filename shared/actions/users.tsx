import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as Constants from '../constants/users'

const initUsers = () => {
  Container.listenAction(EngineGen.keybase1NotifyUsersIdentifyUpdate, (_, action) => {
    const {brokenUsernames, okUsernames} = action.payload.params
    brokenUsernames &&
      Constants.useState.getState().dispatch.updates(
        brokenUsernames.map(name => ({
          info: {broken: true},
          name,
        }))
      )
    okUsernames &&
      Constants.useState.getState().dispatch.updates(
        okUsernames.map(name => ({
          info: {broken: false},
          name,
        }))
      )
  })
}

export default initUsers
