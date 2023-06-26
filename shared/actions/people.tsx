import * as Constants from '../constants/people'
import * as SettingsGen from './settings-gen'
import * as Router2Constants from '../constants/router2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as NotificationsGen from './notifications-gen'
import * as PeopleGen from './people-gen'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as TeamBuildingGen from './team-building-gen'
import {commonListenActions, filterForNs} from './team-building'
import logger from '../logger'
import type * as Types from '../constants/types/people'
import {RPCError} from '../util/errors'

const dismissWotNotifications = async (_: unknown, action: PeopleGen.DismissWotNotificationsPayload) => {
  try {
    await RPCTypes.wotDismissWotNotificationsRpcPromise({
      vouchee: action.payload.vouchee,
      voucher: action.payload.voucher,
    })
  } catch (e) {
    logger.warn('dismissWotUpdate error', e)
  }
}

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  PeopleGen.createBadgeAppForWotNotifications({
    updates: new Map<string, Types.WotUpdate>(Object.entries(action.payload.badgeState.wotUpdates || {})),
  })

const dismissAnnouncement = async (_: unknown, action: PeopleGen.DismissAnnouncementPayload) => {
  await RPCTypes.homeHomeDismissAnnouncementRpcPromise({
    i: action.payload.id,
  })
}

const markViewed = async () => {
  try {
    await RPCTypes.homeHomeMarkViewedRpcPromise()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      throw error
    }
    if (Container.isNetworkErr(error.code)) {
      logger.warn('Network error calling homeMarkViewed')
    } else {
      throw error
    }
  }
}

const skipTodo = async (_: unknown, action: PeopleGen.SkipTodoPayload) => {
  try {
    await RPCTypes.homeHomeSkipTodoTypeRpcPromise({
      t: RPCTypes.HomeScreenTodoType[action.payload.type],
    })
    // TODO get rid of this load and have core send us a homeUIRefresh
    Constants.useState.getState().dispatch.loadPeople(false)
  } catch (_) {}
  return
}

const homeUIRefresh = () => {
  Constants.useState.getState().dispatch.loadPeople(false)
}

const connected = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterHomeUIRpcPromise()
    console.log('Registered home UI')
  } catch (error) {
    console.warn('Error in registering home UI:', error)
  }
}

const onTeamBuildingAdded = (_: Container.TypedState, action: TeamBuildingGen.AddUsersToTeamSoFarPayload) => {
  const {users} = action.payload
  const user = users[0]
  if (!user) return false

  // keybase username is in serviceMap.keybase, otherwise assertion is id
  const username = user.serviceMap.keybase || user.id
  return [
    TeamBuildingGen.createCancelTeamBuilding({namespace: 'people'}),
    ProfileGen.createShowUserProfile({username}),
  ]
}

const maybeMarkViewed = (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  if (
    prev &&
    Router2Constants.getTab(prev) === Tabs.peopleTab &&
    next &&
    Router2Constants.getTab(next) !== Tabs.peopleTab
  ) {
    return PeopleGen.createMarkViewed()
  }
  return false
}

const initPeople = () => {
  Container.listenAction(PeopleGen.markViewed, markViewed)
  Container.listenAction(PeopleGen.skipTodo, skipTodo)
  Container.listenAction(PeopleGen.dismissAnnouncement, dismissAnnouncement)
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  Container.listenAction(PeopleGen.dismissWotNotifications, dismissWotNotifications)
  Container.listenAction(EngineGen.keybase1HomeUIHomeUIRefresh, homeUIRefresh)
  Container.listenAction(EngineGen.connected, connected)
  Container.listenAction(RouteTreeGen.onNavChanged, maybeMarkViewed)
  commonListenActions('people')
  Container.listenAction(TeamBuildingGen.addUsersToTeamSoFar, filterForNs('people', onTeamBuildingAdded))
  Container.listenAction(SettingsGen.emailVerified, (_, a) => {
    Constants.useState.getState().dispatch.setResentEmail(a.payload.email)
  })
}

export default initPeople
