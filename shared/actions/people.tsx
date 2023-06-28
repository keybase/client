import * as Constants from '../constants/people'
import * as SettingsGen from './settings-gen'
import * as Router2Constants from '../constants/router2'
import * as ProfileConstants from '../constants/profile'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as TeamBuildingGen from './team-building-gen'
import {commonListenActions, filterForNs} from './team-building'

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

const onTeamBuildingAdded = (_: Container.TypedState, action: TeamBuildingGen.AddUsersToTeamSoFarPayload) => {
  const {users} = action.payload
  const user = users[0]
  if (!user) return false

  // keybase username is in serviceMap.keybase, otherwise assertion is id
  const username = user.serviceMap.keybase || user.id
  ProfileConstants.useState.getState().dispatch.showUserProfile(username)
  return TeamBuildingGen.createCancelTeamBuilding({namespace: 'people'})
}

const initPeople = () => {
  // Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
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
  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    if (
      prev &&
      Router2Constants.getTab(prev) === Tabs.peopleTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.markViewed()
    }
  })
  commonListenActions('people')
  Container.listenAction(TeamBuildingGen.addUsersToTeamSoFar, filterForNs('people', onTeamBuildingAdded))
  Container.listenAction(SettingsGen.emailVerified, (_, a) => {
    Constants.useState.getState().dispatch.setResentEmail(a.payload.email)
  })
}

export default initPeople
