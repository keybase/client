// @flow
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RPCTypes from '../constants/types/flow-types'

const _getPeopleData = function(action: PeopleGen.GetPeopleDataPayload) {
  return Saga.call(RPCTypes.homeHomeGetScreenRpcPromise, {
    markViewed: action.payload.markViewed,
    numFollowSuggestionsWanted: action.payload.numFollowSuggestionsWanted,
  })
}

const _processPeopleData = function(data: RPCTypes.HomeScreen) {
  let oldItems: I.List<Types.PeopleScreenItem> = I.List()
  let newItems: I.List<Types.PeopleScreenItem> = I.List()
  console.log(data)
  if (data.items) {
    data.items.forEach(item => {
      if (item.data.t === RPCTypes.homeHomeScreenItemType.todo) {
        const todoType = Constants.todoTypeEnumToType[(item.data.todo && item.data.todo.t) || 0]
        newItems = newItems.push({
          type: 'todo',
          badged: item.badged,
          todoType,
          instructions: Constants.todoTypeToInstructions[todoType],
          confirmLabel: Constants.todoTypeToConfirmLabel[todoType],
          dismissable: Constants.todoTypeToDismissable[todoType],
        })
      } else if (item.data.t === RPCTypes.homeHomeScreenItemType.people) {
        // TODO (no pun intended)
      }
    })
  }
  return Saga.put(
    PeopleGen.createPeopleDataProcessed({oldItems, newItems, lastViewed: new Date(data.lastViewed)})
  )
}

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(PeopleGen.getPeopleData, _getPeopleData, _processPeopleData)
}

export default peopleSaga
