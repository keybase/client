import * as Saga from '../util/saga'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import {TypedState} from '../constants/reducer'

const test = async (_: TypedState, action: RecoverPasswordGen.StartRecoverPasswordPayload) => {
  // hello world
  console.log(action)
  return []
}

function* recoverPasswordSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(RecoverPasswordGen.startRecoverPassword, test)
}

export default recoverPasswordSaga