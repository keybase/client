import * as EngineGen from './engine-gen-gen'
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import {networkErrorCodes} from '../util/container'

// set this to true to have all todo items show up all the time
const debugTodo = false

const getPeopleData = (state, action: PeopleGen.GetPeopleDataPayload) => {
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
        .filter(item => !item.badged && item.data.t !== RPCTypes.HomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())
      let newItems: I.List<Types.PeopleScreenItem> = (data.items || [])
        .filter(item => item.badged || item.data.t === RPCTypes.HomeScreenItemType.todo)
        .reduce(Constants.reduceRPCItemToPeopleItem, I.List())

      if (debugTodo) {
        const allTodos: Array<Types.TodoType> = Object.values(Constants.todoTypeEnumToType)
        allTodos.forEach(todoType => {
          if (newItems.some(t => t.type === 'todo' && t.todoType === todoType)) {
            return
          }
          newItems = newItems.push(
            Constants.makeTodo({
              badged: true,
              confirmLabel: Constants.todoTypeToConfirmLabel[todoType],
              dismissable: Constants.todoTypeToDismissable[todoType],
              icon: Constants.todoTypeToIcon[todoType],
              instructions: Constants.todoTypeToInstructions[todoType],
              todoType,
              type: 'todo',
            })
          )
        })
      }

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

const dismissAnnouncement = (_, action: PeopleGen.DismissAnnouncementPayload) =>
  RPCTypes.homeHomeDismissAnnouncementRpcPromise({
    i: action.payload.id,
  }).then(() => {})

const markViewed = () =>
  RPCTypes.homeHomeMarkViewedRpcPromise().catch(err => {
    if (networkErrorCodes.includes(err.code)) {
      logger.warn('Network error calling homeMarkViewed')
    } else {
      throw err
    }
  })

const skipTodo = (_, action: PeopleGen.SkipTodoPayload) =>
  RPCTypes.homeHomeSkipTodoTypeRpcPromise({
    t: RPCTypes.HomeScreenTodoType[action.payload.type],
  }).then(() =>
    // TODO get rid of this load and have core send us a homeUIRefresh
    PeopleGen.createGetPeopleData({
      markViewed: false,
      numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
    })
  )

let _wasOnPeopleTab = false
const homeUIRefresh = (_, action: EngineGen.Keybase1HomeUIHomeUIRefreshPayload) =>
  _wasOnPeopleTab &&
  PeopleGen.createGetPeopleData({
    markViewed: false,
    numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
  })

const connected = () => {
  RPCTypes.delegateUiCtlRegisterHomeUIRpcPromise()
    .then(() => console.log('Registered home UI'))
    .catch(error => console.warn('Error in registering home UI:', error))
}

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<PeopleGen.GetPeopleDataPayload>(PeopleGen.getPeopleData, getPeopleData)
  yield* Saga.chainAction<PeopleGen.MarkViewedPayload>(PeopleGen.markViewed, markViewed)
  yield* Saga.chainAction<PeopleGen.SkipTodoPayload>(PeopleGen.skipTodo, skipTodo)
  yield* Saga.chainAction<PeopleGen.DismissAnnouncementPayload>(
    PeopleGen.dismissAnnouncement,
    dismissAnnouncement
  )
  yield* Saga.chainAction<EngineGen.Keybase1HomeUIHomeUIRefreshPayload>(
    EngineGen.keybase1HomeUIHomeUIRefresh,
    homeUIRefresh
  )
  yield* Saga.chainAction<EngineGen.ConnectedPayload>(EngineGen.connected, connected)
}

export default peopleSaga
