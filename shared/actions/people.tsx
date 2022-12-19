import * as Constants from '../constants/people'
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

// set this to true to have all todo items + a contact joined notification show up all the time
const debugTodo = false

const getPeopleData = async (state: Container.TypedState, action: PeopleGen.GetPeopleDataPayload) => {
  // more logging to understand why this fails so much
  logger.info(
    'getPeopleData: appFocused:',
    state.config.appFocused,
    'loggedIn',
    state.config.loggedIn,
    'action',
    action
  )
  let markViewed = false
  let numFollowSuggestionsWanted = Constants.defaultNumFollowSuggestions
  if (action.type === PeopleGen.getPeopleData) {
    markViewed = action.payload.markViewed
    numFollowSuggestionsWanted = action.payload.numFollowSuggestionsWanted
  }

  try {
    const data = await RPCTypes.homeHomeGetScreenRpcPromise(
      {markViewed, numFollowSuggestionsWanted},
      Constants.getPeopleDataWaitingKey
    )
    const following = state.config.following
    const followers = state.config.followers
    const oldItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
      .filter(item => !item.badged && item.data.t !== RPCTypes.HomeScreenItemType.todo)
      .reduce(Constants.reduceRPCItemToPeopleItem, [])
    const newItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
      .filter(item => item.badged || item.data.t === RPCTypes.HomeScreenItemType.todo)
      .reduce(Constants.reduceRPCItemToPeopleItem, [])

    if (debugTodo) {
      const allTodos = Object.values(RPCTypes.HomeScreenTodoType).reduce<Array<RPCTypes.HomeScreenTodoType>>(
        (arr, t) => {
          typeof t !== 'string' && arr.push(t)
          return arr
        },
        []
      )
      allTodos.forEach(avdlType => {
        const todoType = Constants.todoTypeEnumToType[avdlType]
        if (newItems.some(t => t.type === 'todo' && t.todoType === todoType)) {
          return
        }
        const instructions = Constants.makeDescriptionForTodoItem({
          legacyEmailVisibility: 'user@example.com',
          t: avdlType,
          verifyAllEmail: 'user@example.com',
          verifyAllPhoneNumber: '+1555000111',
        } as any)
        let metadata: Types.TodoMetaEmail | Types.TodoMetaPhone | undefined
        if (
          avdlType === RPCTypes.HomeScreenTodoType.verifyAllEmail ||
          avdlType === RPCTypes.HomeScreenTodoType.legacyEmailVisibility
        ) {
          metadata = Constants.makeTodoMetaEmail({
            email: 'user@example.com',
          })
        } else if (avdlType === RPCTypes.HomeScreenTodoType.verifyAllPhoneNumber) {
          metadata = Constants.makeTodoMetaPhone({
            phone: '+1555000111',
          })
        }
        newItems.push(
          Constants.makeTodo({
            badged: true,
            confirmLabel: Constants.todoTypeToConfirmLabel[todoType],
            icon: Constants.todoTypeToIcon[todoType],
            instructions,
            metadata,
            todoType,
            type: 'todo',
          })
        )
      })
      newItems.unshift(
        Constants.makeFollowedNotificationItem({
          badged: true,
          newFollows: [
            Constants.makeFollowedNotification({
              contactDescription: 'Danny Test -- dannytest39@keyba.se',
              username: 'dannytest39',
            }),
          ],
          notificationTime: new Date(),
          type: 'contact',
        })
      )
    }

    const followSuggestions = (data.followSuggestions ?? []).reduce<Array<Types.FollowSuggestion>>(
      (list, suggestion) => {
        const followsMe = followers.has(suggestion.username)
        const iFollow = following.has(suggestion.username)
        list.push(
          Constants.makeFollowSuggestion({
            followsMe,
            fullName: suggestion.fullName,
            iFollow,
            username: suggestion.username,
          })
        )
        return list
      },
      []
    )

    return PeopleGen.createPeopleDataProcessed({
      followSuggestions,
      lastViewed: new Date(data.lastViewed),
      newItems,
      oldItems,
      version: data.version,
    })
    // never throw black bars
  } catch (_) {
    return false
  }
}

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
    return PeopleGen.createGetPeopleData({
      markViewed: false,
      numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
    })
  } catch (_) {}
  return false
}

const homeUIRefresh = () =>
  PeopleGen.createGetPeopleData({
    markViewed: false,
    numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
  })

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
  Container.listenAction(PeopleGen.getPeopleData, getPeopleData)
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
}

export default initPeople
