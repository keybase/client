import * as I from 'immutable'
import * as ConfigGen from '../config-gen'
import * as Saga from '../../util/saga'
import {TypedState} from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'

const maxAvatarsPerLoad = 50

const _validNames = (names: Array<string>) => names.filter(name => !!name.match(/^([.a-z0-9_-]{1,1000})$/i))

const avatarsToLoad = {
  teams: I.Set(),
  users: I.Set(),
}

const addToAvatarQueue = (
  _: TypedState,
  action: ConfigGen.LoadAvatarsPayload | ConfigGen.LoadTeamAvatarsPayload
) => {
  if (action.type === ConfigGen.loadAvatars) {
    const usernames = _validNames(action.payload.usernames)
    avatarsToLoad.users = avatarsToLoad.users.concat(usernames)
  } else {
    const teamnames = _validNames(action.payload.teamnames)
    avatarsToLoad.teams = avatarsToLoad.teams.concat(teamnames)
  }
}

const avatarSizes = [960, 256, 192]
// TODO just make the call and pass to this
function* avatarCallAndHandle(names: Array<string>, method: any) {
  try {
    const resp: any = yield method({
      formats: avatarSizes.map(s => `square_${s}`),
      names,
    })

    const state: TypedState = yield* Saga.selectState()
    const old = state.config.avatars
    const vals: Array<[string, I.Map<number, string>]> = []
    Object.keys(resp.picmap).forEach(name => {
      const map = resp.picmap[name] || {}
      const sizes = I.Map(avatarSizes.map(size => [size, map[`square_${size}`]]))

      // only send if it changed
      if (!sizes.equals(old.get(name))) {
        vals.push([name, sizes])
      }
    })

    if (vals.length) {
      yield Saga.put(ConfigGen.createLoadedAvatars({avatars: I.Map(vals)}))
    }
  } catch (error) {
    if (error.code === RPCTypes.StatusCode.scinputerror) {
      yield Saga.put(ConfigGen.createGlobalError({globalError: error}))
    }
  }
}

function* handleAvatarQueue() {
  while (true) {
    // nothign in queue, keep listening
    if (!avatarsToLoad.users.size && !avatarsToLoad.teams.size) {
      yield Saga.take([ConfigGen.loadAvatars, ConfigGen.loadTeamAvatars])
    }

    const usernames = avatarsToLoad.users.take(maxAvatarsPerLoad).toArray()
    // eslint is confused i think
    // eslint-disable-next-line require-atomic-updates
    avatarsToLoad.users = avatarsToLoad.users.skip(maxAvatarsPerLoad)
    if (usernames.length) {
      // @ts-ignore codemod issue
      yield* avatarCallAndHandle(usernames, RPCTypes.avatarsLoadUserAvatarsRpcPromise)
    }

    const teamnames = avatarsToLoad.teams.take(maxAvatarsPerLoad).toArray()
    // eslint is confused i think
    // eslint-disable-next-line require-atomic-updates
    avatarsToLoad.teams = avatarsToLoad.teams.skip(maxAvatarsPerLoad)
    if (teamnames.length) {
      // @ts-ignore codemod issue
      yield* avatarCallAndHandle(teamnames, RPCTypes.avatarsLoadTeamAvatarsRpcPromise)
    }

    yield Saga.delay(100)
  }
}

function* avatarSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<ConfigGen.LoadAvatarsPayload | ConfigGen.LoadTeamAvatarsPayload>(
    [ConfigGen.loadAvatars, ConfigGen.loadTeamAvatars],
    addToAvatarQueue
  )
  yield Saga.spawn(handleAvatarQueue)
}

export default avatarSaga
