import * as EngineGen from './engine-gen-gen'
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {RPCError} from '../util/errors'
import logger from '../logger'

// set this to true to have all todo items show up all the time
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
    const oldItems: I.List<Types.PeopleScreenItem> = (data.items || [])
      .filter(item => !item.badged && item.data.t !== RPCTypes.HomeScreenItemType.todo)
      .reduce(Constants.reduceRPCItemToPeopleItem, I.List())
    let newItems: I.List<Types.PeopleScreenItem> = (data.items || [])
      .filter(item => item.badged || item.data.t === RPCTypes.HomeScreenItemType.todo)
      .reduce(Constants.reduceRPCItemToPeopleItem, I.List())

    if (debugTodo) {
      const allTodos: Array<RPCTypes.HomeScreenTodoType> = Object.values(RPCTypes.HomeScreenTodoType)
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
        newItems = newItems.push(
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
  } catch (_) {
    return false
  }
}

const dismissAnnouncement = async (_: Container.TypedState, action: PeopleGen.DismissAnnouncementPayload) => {
  await RPCTypes.homeHomeDismissAnnouncementRpcPromise({
    i: action.payload.id,
  })
}

const markViewed = async () => {
  try {
    await RPCTypes.homeHomeMarkViewedRpcPromise()
  } catch (e) {
    const err: RPCError = e
    if (Container.isNetworkErr(err.code)) {
      logger.warn('Network error calling homeMarkViewed')
    } else {
      throw err
    }
  }
}

const skipTodo = async (_: Container.TypedState, action: PeopleGen.SkipTodoPayload) => {
  await RPCTypes.homeHomeSkipTodoTypeRpcPromise({
    t: RPCTypes.HomeScreenTodoType[action.payload.type],
  })
  // TODO get rid of this load and have core send us a homeUIRefresh
  return PeopleGen.createGetPeopleData({
    markViewed: false,
    numFollowSuggestionsWanted: Constants.defaultNumFollowSuggestions,
  })
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

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(PeopleGen.getPeopleData, getPeopleData)
  yield* Saga.chainAction2(PeopleGen.markViewed, markViewed)
  yield* Saga.chainAction2(PeopleGen.skipTodo, skipTodo)
  yield* Saga.chainAction2(PeopleGen.dismissAnnouncement, dismissAnnouncement)
  yield* Saga.chainAction2(EngineGen.keybase1HomeUIHomeUIRefresh, homeUIRefresh)
  yield* Saga.chainAction2(EngineGen.connected, connected)
}

export default peopleSaga
