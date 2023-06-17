import * as Constants from '../constants/people'
import * as ConfigConstants from '../constants/config'
import type {IconType} from '../common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters
import * as Router2Constants from '../constants/router2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as NotificationsGen from './notifications-gen'
import * as PeopleGen from './people-gen'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as Followers from '../constants/followers'
import * as TeamBuildingGen from './team-building-gen'
import {commonListenActions, filterForNs} from './team-building'
import logger from '../logger'
import type * as Types from '../constants/types/people'
import {RPCError} from '../util/errors'
import invert from 'lodash/invert'

// set this to true to have all todo items + a contact joined notification show up all the time
const debugTodo = false

const defaultNumFollowSuggestions = 10
const todoTypeEnumToType = invert(RPCTypes.HomeScreenTodoType) as {
  [K in Types.TodoTypeEnum]: Types.TodoType
}

const todoTypeToInstructions: {[K in Types.TodoType]: string} = {
  addEmail: 'Add an email address for security purposes, and to get important notifications.',
  addPhoneNumber: 'Add your phone number so your friends can find you.',
  annoncementPlaceholder: '',
  avatarTeam: 'Change your team’s avatar from within the Keybase app.',
  avatarUser: 'Upload your profile picture, or an avatar.',
  bio: 'Add your name, bio, and location to complete your profile.',
  chat: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
  device: `Install Keybase on your ${
    Container.isMobile ? 'computer' : 'phone'
  }. Until you have at least 2 devices, you risk losing data.`,
  folder:
    'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
  follow:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
  gitRepo:
    'Create an encrypted Git repository! Only you (and teammates) will be able to decrypt any of it. And it’s so easy!',
  legacyEmailVisibility: '',
  none: '',
  paperkey:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  proof: 'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  team: 'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out the team settings on any team you manage.`,
  verifyAllEmail: '',
  verifyAllPhoneNumber: '',
}

const todoTypeToIcon: {[K in Types.TodoType]: IconType} = {
  addEmail: 'icon-onboarding-email-add-48',
  addPhoneNumber: 'icon-onboarding-number-new-48',
  annoncementPlaceholder: 'iconfont-close',
  avatarTeam: 'icon-onboarding-team-avatar-48',
  avatarUser: 'icon-onboarding-user-avatar-48',
  bio: 'icon-onboarding-user-info-48',
  chat: 'icon-onboarding-chat-48',
  device: Container.isMobile ? 'icon-onboarding-computer-48' : 'icon-onboarding-phone-48',
  folder: 'icon-onboarding-folder-48',
  follow: 'icon-onboarding-follow-48',
  gitRepo: 'icon-onboarding-git-48',
  legacyEmailVisibility: 'icon-onboarding-email-searchable-48',
  none: 'iconfont-close',
  paperkey: 'icon-onboarding-paper-key-48',
  proof: 'icon-onboarding-proofs-48',
  team: 'icon-onboarding-team-48',
  teamShowcase: 'icon-onboarding-team-publicity-48',
  verifyAllEmail: 'icon-onboarding-email-verify-48',
  verifyAllPhoneNumber: 'icon-onboarding-number-verify-48',
} as const

const todoTypeToConfirmLabel: {[K in Types.TodoType]: string} = {
  addEmail: 'Add email',
  addPhoneNumber: 'Add number',
  annoncementPlaceholder: '',
  avatarTeam: 'Edit team avatar',
  avatarUser: 'Upload avatar',
  bio: 'Edit Profile',
  chat: 'Start a chat',
  device: Container.isMobile ? 'Get the download link' : 'Get the app',
  folder: 'Open a private folder',
  follow: 'Search people',
  gitRepo: Container.isMobile ? 'Create a repo' : 'Create a personal git repo',
  legacyEmailVisibility: '',
  none: '',
  paperkey: 'Create a paper key',
  proof: 'Prove your identities',
  team: 'Create a team!',
  teamShowcase: 'Set publicity settings',
  verifyAllEmail: 'Verify',
  verifyAllPhoneNumber: 'Verify',
}

function makeDescriptionForTodoItem(todo: RPCTypes.HomeScreenTodo) {
  const T = RPCTypes.HomeScreenTodoType
  switch (todo.t) {
    case T.legacyEmailVisibility:
      return `Allow friends to find you using *${todo.legacyEmailVisibility}*?`
    case T.verifyAllEmail:
      return `Your email address *${todo.verifyAllEmail}* is unverified.`
    case T.verifyAllPhoneNumber: {
      const {e164ToDisplay} = require('../util/phone-numbers')
      const p = todo.verifyAllPhoneNumber
      return `Your number *${p ? e164ToDisplay(p) : ''}* is unverified.`
    }
    default: {
      const type = todoTypeEnumToType[todo.t]
      return todoTypeToInstructions[type]
    }
  }
}

function extractMetaFromTodoItem(todo: RPCTypes.HomeScreenTodo, todoExt?: RPCTypes.HomeScreenTodoExt) {
  const T = RPCTypes.HomeScreenTodoType
  switch (todo.t) {
    case T.legacyEmailVisibility:
      return Constants.makeTodoMetaEmail({email: todo.legacyEmailVisibility})
    case T.verifyAllEmail:
      return Constants.makeTodoMetaEmail({
        email: todo.verifyAllEmail || '',
        lastVerifyEmailDate:
          todoExt && todoExt.t === T.verifyAllEmail ? todoExt.verifyAllEmail.lastVerifyEmailDate : 0,
      })
    case T.verifyAllPhoneNumber:
      return Constants.makeTodoMetaPhone({phone: todo.verifyAllPhoneNumber})
    default:
      return
  }
}

const reduceRPCItemToPeopleItem = (
  list: Array<Types.PeopleScreenItem>,
  item: RPCTypes.HomeScreenItem
): Array<Types.PeopleScreenItem> => {
  const badged = item.badged
  if (item.data.t === RPCTypes.HomeScreenItemType.todo) {
    const todo = item.data.todo
    const todoExt: RPCTypes.HomeScreenTodoExt | undefined =
      item.dataExt.t === RPCTypes.HomeScreenItemType.todo ? item.dataExt.todo : undefined

    const todoType = todoTypeEnumToType[todo.t || 0]
    const metadata: Types.TodoMeta = extractMetaFromTodoItem(todo, todoExt)
    return [
      ...list,
      Constants.makeTodo({
        badged: badged,
        confirmLabel: todoTypeToConfirmLabel[todoType],
        icon: todoTypeToIcon[todoType],
        instructions: makeDescriptionForTodoItem(todo),
        metadata,
        todoType,
        type: 'todo',
      }),
    ]
  } else if (item.data.t === RPCTypes.HomeScreenItemType.people) {
    // Follow notification or contact resolution
    const notification = item.data.people
    if (notification.t === RPCTypes.HomeScreenPeopleNotificationType.followed) {
      // Single follow notification
      const follow = notification.followed
      if (!follow) {
        return list
      }
      return [
        ...list,
        Constants.makeFollowedNotificationItem({
          badged,
          newFollows: [Constants.makeFollowedNotification({username: follow.user.username})],
          notificationTime: new Date(follow.followTime),
          type: 'follow',
        }),
      ]
    } else if (notification.t === RPCTypes.HomeScreenPeopleNotificationType.followedMulti) {
      // Multiple follows notification
      const multiFollow = notification.followedMulti
      const followers = multiFollow.followers
      if (!followers) {
        return list
      }
      const notificationTimes = followers.map(follow => follow.followTime)
      const maxNotificationTime = Math.max(...notificationTimes)
      const notificationTime = new Date(maxNotificationTime)
      return [
        ...list,
        Constants.makeFollowedNotificationItem({
          badged,
          newFollows: followers.map(follow =>
            Constants.makeFollowedNotification({username: follow.user.username})
          ),
          notificationTime,
          numAdditional: multiFollow.numOthers,
          type: 'follow',
        }),
      ]
    } else if (notification && notification.t === RPCTypes.HomeScreenPeopleNotificationType.contact) {
      // Single contact notification
      const follow = notification.contact
      return [
        ...list,
        Constants.makeFollowedNotificationItem({
          badged,
          newFollows: [
            Constants.makeFollowedNotification({
              contactDescription: follow.description,
              username: follow.username,
            }),
          ],
          notificationTime: new Date(follow.resolveTime),
          type: 'contact',
        }),
      ]
    } else if (notification && notification.t === RPCTypes.HomeScreenPeopleNotificationType.contactMulti) {
      // Multiple follows notification
      const multiContact = notification.contactMulti
      const contacts = multiContact.contacts
      if (!contacts) {
        return list
      }
      const notificationTimes = contacts.map(contact => contact.resolveTime)
      const maxNotificationTime = Math.max(...notificationTimes)
      const notificationTime = new Date(maxNotificationTime)
      return [
        ...list,
        Constants.makeFollowedNotificationItem({
          badged,
          newFollows: contacts.map(follow =>
            Constants.makeFollowedNotification({
              contactDescription: follow.description,
              username: follow.username,
            })
          ),
          notificationTime,
          numAdditional: multiContact.numOthers,
          type: 'contact',
        }),
      ]
    }
  } else if (item.data.t === RPCTypes.HomeScreenItemType.announcement) {
    const a = item.data.announcement
    return [
      ...list,
      Constants.makeAnnouncement({
        appLink: a.appLink,
        badged,
        confirmLabel: a.confirmLabel,
        dismissable: a.dismissable,
        iconUrl: a.iconUrl,
        id: a.id,
        text: a.text,
        url: a.url,
      }),
    ]
  }

  return list
}
const getPeopleData = async (_: unknown, action: PeopleGen.GetPeopleDataPayload) => {
  // more logging to understand why this fails so much
  logger.info(
    'getPeopleData: appFocused:',
    'loggedIn',
    ConfigConstants.useConfigState.getState().loggedIn,
    'action',
    action
  )
  let markViewed = false
  let numFollowSuggestionsWanted = defaultNumFollowSuggestions
  if (action.type === PeopleGen.getPeopleData) {
    markViewed = action.payload.markViewed
    numFollowSuggestionsWanted = action.payload.numFollowSuggestionsWanted
  }

  try {
    const data = await RPCTypes.homeHomeGetScreenRpcPromise(
      {markViewed, numFollowSuggestionsWanted},
      Constants.getPeopleDataWaitingKey
    )
    const {following, followers} = Followers.useFollowerState.getState()
    const oldItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
      .filter(item => !item.badged && item.data.t !== RPCTypes.HomeScreenItemType.todo)
      .reduce(reduceRPCItemToPeopleItem, [])
    const newItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
      .filter(item => item.badged || item.data.t === RPCTypes.HomeScreenItemType.todo)
      .reduce(reduceRPCItemToPeopleItem, [])

    if (debugTodo) {
      const allTodos = Object.values(RPCTypes.HomeScreenTodoType).reduce<Array<RPCTypes.HomeScreenTodoType>>(
        (arr, t) => {
          typeof t !== 'string' && arr.push(t)
          return arr
        },
        []
      )
      allTodos.forEach(avdlType => {
        const todoType = todoTypeEnumToType[avdlType]
        if (newItems.some(t => t.type === 'todo' && t.todoType === todoType)) {
          return
        }
        const instructions = makeDescriptionForTodoItem({
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
            confirmLabel: todoTypeToConfirmLabel[todoType],
            icon: todoTypeToIcon[todoType],
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
      numFollowSuggestionsWanted: defaultNumFollowSuggestions,
    })
  } catch (_) {}
  return false
}

const homeUIRefresh = () =>
  PeopleGen.createGetPeopleData({
    markViewed: false,
    numFollowSuggestionsWanted: defaultNumFollowSuggestions,
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
