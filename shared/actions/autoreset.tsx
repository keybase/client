import * as Saga from '../util/saga'
import * as Container from '../util/container'

import * as NotificationsGen from './notifications-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as AutoresetGen from './autoreset-gen'
import * as RPCGen from '../constants/types/rpc-gen'

import * as Constants from '../constants/autoreset'

const receivedBadgeState = async (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const newResetState = action.payload.badgeState.resetState
  if (state.autoreset !== newResetState) {
    return [
      ...(newResetState.active ? [RouteTreeGen.createNavigateAppend({path: ['resetModal']})] : []),
      AutoresetGen.createUpdateAutoresetState(action.payload.badgeState.resetState),
    ]
  }
  return null
}

const cancelReset = async () => {
  await RPCGen.accountCancelResetRpcPromise(undefined, Constants.waitingKeyCancelReset)
  return AutoresetGen.createResetCancelled()
}

function* autoresetSaga() {
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')
  yield* Saga.chainAction2(AutoresetGen.cancelReset, cancelReset, 'cancelReset')
}

export default autoresetSaga
