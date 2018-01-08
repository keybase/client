// @flow
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RouteTypes from '../constants/types/route-tree'
import * as RouteConstants from '../constants/route-tree'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'
import {peopleTab} from '../constants/tabs'
import {type TypedState} from '../constants/reducer'
import {createDecrementWaiting, createIncrementWaiting} from '../actions/waiting-gen'

const _getPeopleData = function(action: PeopleGen.GetPeopleDataPayload, state: TypedState) {
  return Saga.sequentially([
    Saga.put(createIncrementWaiting({key: Constants.getPeopleDataWaitingKey})),
    Saga.call(RPCTypes.homeHomeGetScreenRpcPromise, {
      markViewed: action.payload.markViewed,
      numFollowSuggestionsWanted: action.payload.numFollowSuggestionsWanted,
    }),
    Saga.identity(state.config.following),
    Saga.identity(state.config.followers),
  ])
}

const _processPeopleData = function([
  _: any,
  data: RPCTypes.HomeScreen,
  following: I.Set<string>,
  followers: I.Set<string>,
]) {
  const oldItems: I.List<Types.PeopleScreenItem> =
    (data.items &&
      data.items
        .filter(item => !item.badged && item.data.t !== RPCTypes.homeHomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())) ||
    I.List()
  const newItems: I.List<Types.PeopleScreenItem> =
    (data.items &&
      data.items
        .filter(item => item.badged || item.data.t === RPCTypes.homeHomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())) ||
    I.List()

  const followSuggestions: I.List<Types.FollowSuggestion> =
    (data.followSuggestions &&
      data.followSuggestions.reduce((list, suggestion) => {
        const followsMe = followers.has(suggestion.username)
        const iFollow = following.has(suggestion.username)
        return list.push(
          Constants.makeFollowSuggestion({
            username: suggestion.username,
            followsMe,
            iFollow,
            fullName: suggestion.fullName,
          })
        )
      }, I.List())) ||
    I.List()

  return Saga.all([
    Saga.put(
      PeopleGen.createPeopleDataProcessed({
        oldItems,
        newItems,
        lastViewed: new Date(data.lastViewed),
        followSuggestions,
        version: data.version,
      })
    ),
    Saga.put(createDecrementWaiting({key: Constants.getPeopleDataWaitingKey})),
  ])
}

const _skipTodo = (action: PeopleGen.SkipTodoPayload) => {
  return Saga.sequentially([
    Saga.call(RPCTypes.homeHomeSkipTodoTypeRpcPromise, {
      t: RPCTypes.homeHomeScreenTodoType[action.payload.type],
    }),
    // TODO get rid of this load and have core send us a homeUIRefresh
    Saga.put(
      PeopleGen.createGetPeopleData({
        markViewed: true,
        numFollowSuggestionsWanted: Constants.DEFAULT_FOLLOW_SUGGESTIONS_QUANT,
      })
    ),
  ])
}

const _setupPeopleHandlers = () => {
  return Saga.put((dispatch: Dispatch) => {
    engine().setIncomingHandler('keybase.1.homeUi.homeUIRefresh', (args: {||}) => {
      dispatch(
        PeopleGen.createGetPeopleData({
          markViewed: false,
          numFollowSuggestionsWanted: Constants.DEFAULT_FOLLOW_SUGGESTIONS_QUANT,
        })
      )
    })
  })
}

let _wasOnPeopleTab = false
const _onTabChange = (action: RouteTypes.SwitchTo) => {
  // TODO replace this with notification based refreshing
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root !== peopleTab) {
    _wasOnPeopleTab = false
  } else if (root === peopleTab && !_wasOnPeopleTab) {
    _wasOnPeopleTab = true
    return Saga.put(
      PeopleGen.createGetPeopleData({
        markViewed: true,
        numFollowSuggestionsWanted: Constants.DEFAULT_FOLLOW_SUGGESTIONS_QUANT,
      })
    )
  }
}

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(PeopleGen.getPeopleData, _getPeopleData, _processPeopleData, () =>
    // TODO replace this with engine handling once that lands
    Saga.put(createDecrementWaiting({key: Constants.getPeopleDataWaitingKey}))
  )
  yield Saga.safeTakeEveryPure(PeopleGen.skipTodo, _skipTodo)
  yield Saga.safeTakeEveryPure(PeopleGen.setupPeopleHandlers, _setupPeopleHandlers)
  yield Saga.safeTakeEveryPure(RouteConstants.switchTo, _onTabChange)
}

export default peopleSaga
