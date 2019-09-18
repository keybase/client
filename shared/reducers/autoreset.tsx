import * as Container from '../util/container'
import * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'
import * as NotificationsGen from '../actions/notifications-gen'
const initialState: Types.State = {
  active: false,
  endTime: 0,
}

export default (
  state: Types.State = initialState,
  action: AutoresetGen.Actions | NotificationsGen.ReceivedBadgeStatePayload
): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case AutoresetGen.resetStore:
        return initialState
      case NotificationsGen.receivedBadgeState:
        draftState.active = action.payload.badgeState.resetState.active
        draftState.endTime = action.payload.badgeState.resetState.endTime
        return
      case AutoresetGen.resetCancelled:
        draftState.active = false
        return
      // saga only actions
      case AutoresetGen.cancelReset:
        return
    }
  })
