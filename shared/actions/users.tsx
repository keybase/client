// import * as UsersGen from './users-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'

const onIdentifyUpdate = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload
) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

function* usersSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(EngineGen.keybase1NotifyUsersIdentifyUpdate, onIdentifyUpdate, 'onIdentifyUpdate')
}

export default usersSaga
