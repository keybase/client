import * as Constants from '../constants/people'
import * as RouterConstants from '../constants/router2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'

// const dismissWotNotifications = async (_: unknown, action: PeopleGen.DismissWotNotificationsPayload) => {
//   try {
//     await RPCTypes.wotDismissWotNotificationsRpcPromise({
//       vouchee: action.payload.vouchee,
//       voucher: action.payload.voucher,
//     })
//   } catch (e) {
//     logger.warn('dismissWotUpdate error', e)
//   }
// }

// const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
//   PeopleGen.createBadgeAppForWotNotifications({
//     updates: new Map<string, Types.WotUpdate>(Object.entries(action.payload.badgeState.wotUpdates || {})),
//   })

const initPeople = () => {
  Container.listenAction(EngineGen.keybase1HomeUIHomeUIRefresh, () => {
    Constants.useState.getState().dispatch.loadPeople(false)
  })
  Container.listenAction(EngineGen.connected, async () => {
    try {
      await RPCTypes.delegateUiCtlRegisterHomeUIRpcPromise()
      console.log('Registered home UI')
    } catch (error) {
      console.warn('Error in registering home UI:', error)
    }
  })
  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    if (
      prev &&
      RouterConstants.getTab(prev) === Tabs.peopleTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.markViewed()
    }
  })
  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, (_, action) => {
    Constants.useState.getState().dispatch.setResentEmail(action.payload.params.emailAddress)
  })
}

export default initPeople
