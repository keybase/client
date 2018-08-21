// @flow
import * as I from 'immutable'
import * as ConfigGen from '../config-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import shallowEqual from 'shallowequal'
import {type TypedState} from '../../constants/reducer'

const maxAvatarsPerLoad = 50

const _validNames = (names: Array<string>) => names.filter(name => !!name.match(/^([.a-z0-9_-]{1,1000})$/i))

const avatarsToLoad = {
  teams: I.Set(),
  users: I.Set(),
}

function* addToAvatarQueue(action: ConfigGen.LoadAvatarsPayload | ConfigGen.LoadTeamAvatarsPayload) {
  if (action.type === ConfigGen.loadAvatars) {
    const usernames = _validNames(action.payload.usernames)
    avatarsToLoad.users = avatarsToLoad.users.concat(usernames)
  } else {
    const teamnames = _validNames(action.payload.teamnames)
    avatarsToLoad.teams = avatarsToLoad.teams.concat(teamnames)
  }

  if (avatarChannel) {
    yield Saga.put(avatarChannel, ConfigGen.create_avatarQueue())
  }
}

const avatarSizes = [960, 256, 192]
function* avatarCallAndHandle(names: Array<string>, method: Function) {
  try {
    const resp = yield Saga.call(method, {
      formats: avatarSizes.map(s => `square_${s}`),
      names,
    })

    const state: TypedState = yield Saga.select()
    const old = state.config.avatars
    const nameToUrlMap = Object.keys(resp.picmap).reduce((nameToUrlMap, name) => {
      const vals = avatarSizes.reduce((map, s) => {
        map[s] = resp.picmap[name][`square_${s}`] || null
        return map
      }, {})

      // only send if it changed
      if (!old[name] || !shallowEqual(old[name], vals)) {
        nameToUrlMap[name] = vals
      }

      return nameToUrlMap
    }, {})

    yield Saga.put(ConfigGen.createLoadedAvatars({nameToUrlMap}))
  } catch (error) {
    if (error.code === RPCTypes.constantsStatusCode.scinputerror) {
      yield Saga.put(ConfigGen.createGlobalError({globalError: error}))
    }
  }
}

let avatarChannel
function* handleAvatarQueue() {
  avatarChannel = yield Saga.channel(Saga.buffers.dropping(1))
  while (true) {
    yield Saga.call(Saga.delay, 100)
    yield Saga.take(avatarChannel)

    const usernames = avatarsToLoad.users.take(maxAvatarsPerLoad).toArray()
    avatarsToLoad.users = avatarsToLoad.users.skip(maxAvatarsPerLoad)
    if (usernames.length) {
      yield Saga.call(avatarCallAndHandle, usernames, RPCTypes.avatarsLoadUserAvatarsRpcPromise)
    }

    const teamnames = avatarsToLoad.teams.take(maxAvatarsPerLoad).toArray()
    avatarsToLoad.teams = avatarsToLoad.teams.skip(maxAvatarsPerLoad)
    if (teamnames.length) {
      yield Saga.call(avatarCallAndHandle, teamnames, RPCTypes.avatarsLoadTeamAvatarsRpcPromise)
    }

    // more to load?
    if (avatarsToLoad.users.size || avatarsToLoad.teams.size) {
      yield Saga.put(avatarChannel, ConfigGen.create_avatarQueue())
    }
  }
}

function* avatarSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(ConfigGen.loadAvatars, addToAvatarQueue)
  yield Saga.safeTakeEvery(ConfigGen.loadTeamAvatars, addToAvatarQueue)
  yield Saga.fork(handleAvatarQueue)
}

export default avatarSaga
