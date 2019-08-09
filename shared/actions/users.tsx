// import * as UsersGen from './users-gen'
import * as Saga from '../util/saga'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'

const onIdentifyUpdate = (_, action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

function* usersSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload>(
    EngineGen.keybase1NotifyUsersIdentifyUpdate,
    onIdentifyUpdate,
    'onIdentifyUpdate'
  )
}

export default usersSaga
