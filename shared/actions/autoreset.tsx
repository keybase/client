import * as Constants from '../constants/autoreset'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'

const initAutoReset = () => {
  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const {resetState} = action.payload.badgeState
    Constants.useState.getState().dispatch.updateARState(resetState.active, resetState.endTime)
  })
}

export default initAutoReset
