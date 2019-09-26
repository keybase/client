import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as AutoresetGen from './autoreset-gen'
import * as RPCGen from '../constants/types/rpc-gen'
import * as Constants from '../constants/autoreset'
import logger from '../logger'

const receivedBadgeState = async (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const newResetState = action.payload.badgeState.resetState
  if (state.autoreset.active !== newResetState.active || state.autoreset.endTime !== newResetState.endTime) {
    logger.info('Received new autoreset state from gregor')
    return AutoresetGen.createUpdateAutoresetState(action.payload.badgeState.resetState)
  }
  return null
}

const cancelReset = async () => {
  logger.info('Cancelled autoreset from logged-in user')
  await RPCGen.accountCancelResetRpcPromise(undefined, Constants.waitingKeyCancelReset)
  return AutoresetGen.createResetCancelled()
}

const updateAutoresetState = (_: Container.TypedState, action: AutoresetGen.UpdateAutoresetStatePayload) =>
  action.payload.active ? [RouteTreeGen.createNavigateAppend({path: ['resetModal']})] : null

function* autoresetSaga() {
  yield* Saga.chainAction2(AutoresetGen.updateAutoresetState, updateAutoresetState, 'updateAutoresetState')
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')
  yield* Saga.chainAction2(AutoresetGen.cancelReset, cancelReset, 'cancelReset')
}

export default autoresetSaga
