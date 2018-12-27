// @flow
import * as ConfigGen from './config-gen'
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import engine from '../engine'
import {peopleTab} from '../constants/tabs'
import {getPath} from '../route-tree'

const getPeopleData = (state, action) => {
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
  return RPCTypes.homeHomeGetScreenRpcPromise(
    {markViewed, numFollowSuggestionsWanted},
    Constants.getPeopleDataWaitingKey
  )
    .then((data: RPCTypes.HomeScreen) => {
      const following = state.config.following
      const followers = state.config.followers
      const oldItems: I.List<Types.PeopleScreenItem> = (data.items || [])
        .filter(item => !item.badged && item.data.t !== RPCTypes.homeHomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())
      let newItems: I.List<Types.PeopleScreenItem> = (data.items || [])
        .filter(item => item.badged || item.data.t === RPCTypes.homeHomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())

      const followSuggestions: I.List<Types.FollowSuggestion> = (data.followSuggestions || []).reduce(
        (list, suggestion) => {
          const followsMe = followers.has(suggestion.username)
          const iFollow = following.has(suggestion.username)
          return list.push(
            Constants.makeFollowSuggestion({
              followsMe,
              fullName: suggestion.fullName,
              iFollow,
              username: suggestion.username,
            })
          )
        },
        I.List()
      )

      return PeopleGen.createPeopleDataProcessed({
        followSuggestions,
        lastViewed: new Date(data.lastViewed),
        newItems,
        oldItems,
        version: data.version,
      })
      // never throw black bars
    })
    .catch(e => {})
}

const dismissAnnouncement = (_, action) =>
  RPCTypes.homeHomeDismissAnnouncementRpcPromise({
    i: action.payload.id,
  }).then(() => {})

const markViewed = () =>
  RPCTypes.homeHomeMarkViewedRpcPromise().catch(err => {
    if (networkErrors.includes(err.code)) {
      logger.warn('Network error calling homeMarkViewed')
    } else {
      throw err
    }
  })

const skipTodo = (_, action) =>
  RPCTypes.homeHomeSkipTodoTypeRpcPromise({
    t: RPCTypes.homeHomeScreenTodoType[action.payload.type],
  }).then(() =>
    // TODO get rid of this load and have core send us a homeUIRefresh
    PeopleGen.createGetPeopleData({
      markViewed: false,
      numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
    })
  )

let _wasOnPeopleTab = false
const setupEngineListeners = () => {
  engine().actionOnConnect('registerHomeUI', () => {
    RPCTypes.delegateUiCtlRegisterHomeUIRpcPromise()
      .then(() => console.log('Registered home UI'))
      .catch(error => console.warn('Error in registering home UI:', error))
  })

  engine().setIncomingCallMap({
    'keybase.1.homeUI.homeUIRefresh': () =>
      _wasOnPeopleTab &&
      Saga.put(
        PeopleGen.createGetPeopleData({
          markViewed: false,
          numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
        })
      ),
  })
}

const onNavigateTo = (state, action) => {
  const list = I.List(action.payload.path)
  const root = list.first()
  const peoplePath = getPath(state.routeTree.routeState, [peopleTab])
  if (root === peopleTab && peoplePath.size === 2 && peoplePath.get(1) === 'profile' && _wasOnPeopleTab) {
    // Navigating away from the people tab root to a profile page.
    return PeopleGen.createMarkViewed()
  }
}

const onTabChange = (state, action) => {
  // TODO replace this with notification based refreshing
  const list = I.List(action.payload.path)
  const root = list.first()
  const peoplePath = getPath(state.routeTree.routeState, [peopleTab])

  if (root !== peopleTab && _wasOnPeopleTab && peoplePath.size === 1) {
    _wasOnPeopleTab = false
    return Promise.resolve(PeopleGen.createMarkViewed())
  } else if (root === peopleTab && !_wasOnPeopleTab) {
    _wasOnPeopleTab = true
  }
}

const networkErrors = [
  RPCTypes.constantsStatusCode.scgenericapierror,
  RPCTypes.constantsStatusCode.scapinetworkerror,
  RPCTypes.constantsStatusCode.sctimeout,
]

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<PeopleGen.GetPeopleDataPayload>(PeopleGen.getPeopleData, getPeopleData)
  yield* Saga.chainAction<PeopleGen.MarkViewedPayload>(PeopleGen.markViewed, markViewed)
  yield* Saga.chainAction<PeopleGen.SkipTodoPayload>(PeopleGen.skipTodo, skipTodo)
  yield* Saga.chainAction<RouteTreeGen.SwitchToPayload>(RouteTreeGen.switchTo, onTabChange)
  yield* Saga.chainAction<RouteTreeGen.NavigateToPayload>(RouteTreeGen.navigateTo, onNavigateTo)
  yield* Saga.chainAction<PeopleGen.DismissAnnouncementPayload>(
    PeopleGen.dismissAnnouncement,
    dismissAnnouncement
  )
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default peopleSaga
