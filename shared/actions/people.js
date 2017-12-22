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
  if (!data.items) {
    // $FlowIssue I'm not filling this in
    data.items = [
      {
        badged: true,
        data: {
          t: 2,
          people: {
            t: 0,
            followed: {
              followTime: 1513965111449,
              user: {
                username: 'chris',
              },
            },
          },
        },
      },
    ]
  }
  if (data.items) {
    // $FlowIssue I'm not filling this in
    data.items.push({
      badged: true,
      data: {
        t: 2,
        people: {
          t: 0,
          followed: {
            followTime: 1513965011449,
            user: {
              username: 'max',
            },
          },
        },
      },
    })
    // $FlowIssue because this isn't the line after the if statement
    data.items.forEach(item => {
      const badged = item.badged
      if (item.data.t === RPCTypes.homeHomeScreenItemType.todo) {
        const todoType = Constants.todoTypeEnumToType[(item.data.todo && item.data.todo.t) || 0]
        newItems = newItems.push({
          type: 'todo',
          badged: badged,
          todoType,
          instructions: Constants.todoTypeToInstructions[todoType],
          confirmLabel: Constants.todoTypeToConfirmLabel[todoType],
          dismissable: Constants.todoTypeToDismissable[todoType],
          icon: Constants.todoTypeToIcon[todoType],
        })
      } else if (item.data.t === RPCTypes.homeHomeScreenItemType.people) {
        const notification = item.data.people
        if (notification && notification.t === RPCTypes.homeHomeScreenPeopleNotificationType.followed) {
          const follow = notification.followed
          if (!follow) {
            return
          }
          const item = {
            type: 'notification',
            newFollows: [{username: follow.user.username}],
            notificationTime: new Date(follow.followTime),
            badged,
          }
          if (badged) {
            newItems = newItems.push(item)
          } else {
            oldItems = oldItems.push(item)
          }
        }
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
