import * as ConfigConstants from './config'
import {isNetworkErr, RPCError} from '../util/errors'
import * as Followers from './followers'
import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import {isMobile} from './platform'
import logger from '../logger'
import invert from 'lodash/invert'
import isEqual from 'lodash/isEqual'
import type * as Types from './types/people'
import type {IconType} from '../common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters

// set this to true to have all todo items + a contact joined notification show up all the time
const debugTodo = false

export const getPeopleDataWaitingKey = 'getPeopleData'

export const todoTypes: {[K in Types.TodoType]: Types.TodoType} = {
  addEmail: 'addEmail',
  addPhoneNumber: 'addPhoneNumber',
  annoncementPlaceholder: 'annoncementPlaceholder', // misspelled in protocol
  avatarTeam: 'avatarTeam',
  avatarUser: 'avatarUser',
  bio: 'bio',
  chat: 'chat',
  device: 'device',
  folder: 'folder',
  follow: 'follow',
  gitRepo: 'gitRepo',
  legacyEmailVisibility: 'legacyEmailVisibility',
  none: 'none',
  paperkey: 'paperkey',
  proof: 'proof',
  team: 'team',
  teamShowcase: 'teamShowcase',
  verifyAllEmail: 'verifyAllEmail',
  verifyAllPhoneNumber: 'verifyAllPhoneNumber',
}

const makeAnnouncement = (a?: Partial<Types.Announcement>): Types.Announcement => ({
  badged: false,
  dismissable: false,
  iconUrl: '',
  id: 0,
  text: '',
  type: 'announcement',
  ...a,
})

const makeTodo = (t?: Partial<Types.Todo>): Types.Todo => ({
  badged: false,
  confirmLabel: '',
  dismissable: false,
  icon: 'iconfont-close',
  instructions: '',
  metadata: undefined,
  todoType: 'none',
  type: 'todo',
  ...t,
})

const makeFollowedNotification = (f?: Partial<Types.FollowedNotification>): Types.FollowedNotification => ({
  contactDescription: '',
  username: '',
  ...f,
})

const makeFollowedNotificationItem = (
  f?: Partial<Types.FollowedNotificationItem>
): Types.FollowedNotificationItem => ({
  badged: false,
  newFollows: [],
  notificationTime: new Date(),
  numAdditional: 0,
  type: 'follow',
  ...f,
})

const makeFollowSuggestion = (f?: Partial<Types.FollowSuggestion>): Types.FollowSuggestion => ({
  followsMe: false,
  fullName: undefined,
  iFollow: false,
  username: '',
  ...f,
})

const makeTodoMetaEmail = (t?: Partial<Types.TodoMetaEmail>): Types.TodoMetaEmail => ({
  email: '',
  lastVerifyEmailDate: 0,
  type: 'email',
  ...t,
})

const makeTodoMetaPhone = (t?: Partial<Types.TodoMetaPhone>): Types.TodoMetaPhone => ({
  phone: '',
  type: 'phone',
  ...t,
})

export const defaultNumFollowSuggestions = 10
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
    isMobile ? 'computer' : 'phone'
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
  device: isMobile ? 'icon-onboarding-computer-48' : 'icon-onboarding-phone-48',
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
  device: isMobile ? 'Get the download link' : 'Get the app',
  folder: 'Open a private folder',
  follow: 'Search people',
  gitRepo: isMobile ? 'Create a repo' : 'Create a personal git repo',
  legacyEmailVisibility: '',
  none: '',
  paperkey: 'Create a paper key',
  proof: 'Prove your identities',
  team: 'Create a team!',
  teamShowcase: 'Set publicity settings',
  verifyAllEmail: 'Verify',
  verifyAllPhoneNumber: 'Verify',
}

const makeDescriptionForTodoItem = (todo: RPCTypes.HomeScreenTodo) => {
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

const extractMetaFromTodoItem = (todo: RPCTypes.HomeScreenTodo, todoExt?: RPCTypes.HomeScreenTodoExt) => {
  const T = RPCTypes.HomeScreenTodoType
  switch (todo.t) {
    case T.legacyEmailVisibility:
      return makeTodoMetaEmail({email: todo.legacyEmailVisibility})
    case T.verifyAllEmail:
      return makeTodoMetaEmail({
        email: todo.verifyAllEmail || '',
        lastVerifyEmailDate:
          todoExt && todoExt.t === T.verifyAllEmail ? todoExt.verifyAllEmail.lastVerifyEmailDate : 0,
      })
    case T.verifyAllPhoneNumber:
      return makeTodoMetaPhone({phone: todo.verifyAllPhoneNumber})
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
      makeTodo({
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
        makeFollowedNotificationItem({
          badged,
          newFollows: [makeFollowedNotification({username: follow.user.username})],
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
        makeFollowedNotificationItem({
          badged,
          newFollows: followers.map(follow => makeFollowedNotification({username: follow.user.username})),
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
        makeFollowedNotificationItem({
          badged,
          newFollows: [
            makeFollowedNotification({
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
        makeFollowedNotificationItem({
          badged,
          newFollows: contacts.map(follow =>
            makeFollowedNotification({
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
      makeAnnouncement({
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

type Store = {
  followSuggestions: Array<Types.FollowSuggestion>
  newItems: Array<Types.PeopleScreenItem>
  oldItems: Array<Types.PeopleScreenItem>
  resentEmail: string
}
const initialStore: Store = {
  followSuggestions: [],
  newItems: [],
  oldItems: [],
  resentEmail: '',
}

type State = Store & {
  dispatch: {
    dismissAnnouncement: (id: RPCTypes.HomeScreenAnnouncementID) => void
    loadPeople: (markViewed: boolean, numFollowSuggestionsWanted?: number) => void
    setResentEmail: (email: string) => void
    skipTodo: (type: Types.TodoType) => void
    markViewed: () => void
    resetState: () => void
  }
}

export const useState = Z.createZustand(
  Z.immerZustand<State>((set, get) => {
    const dispatch = {
      dismissAnnouncement: (id: RPCTypes.HomeScreenAnnouncementID) => {
        const f = async () => {
          await RPCTypes.homeHomeDismissAnnouncementRpcPromise({
            i: id,
          })
        }
        Z.ignorePromise(f())
      },
      loadPeople: (markViewed: boolean, numFollowSuggestionsWanted = defaultNumFollowSuggestions) => {
        const f = async () => {
          // more logging to understand why this fails so much
          logger.info(
            'getPeopleData: appFocused:',
            'loggedIn',
            ConfigConstants.useConfigState.getState().loggedIn,
            'action',
            {markViewed, numFollowSuggestionsWanted}
          )

          try {
            const data = await RPCTypes.homeHomeGetScreenRpcPromise(
              {markViewed, numFollowSuggestionsWanted},
              getPeopleDataWaitingKey
            )
            const {following, followers} = Followers.useFollowerState.getState()
            const oldItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
              .filter(item => !item.badged && item.data.t !== RPCTypes.HomeScreenItemType.todo)
              .reduce(reduceRPCItemToPeopleItem, [])
            const newItems: Array<Types.PeopleScreenItem> = (data.items ?? [])
              .filter(item => item.badged || item.data.t === RPCTypes.HomeScreenItemType.todo)
              .reduce(reduceRPCItemToPeopleItem, [])

            if (debugTodo) {
              const allTodos = Object.values(RPCTypes.HomeScreenTodoType).reduce<
                Array<RPCTypes.HomeScreenTodoType>
              >((arr, t) => {
                typeof t !== 'string' && arr.push(t)
                return arr
              }, [])
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
                  metadata = makeTodoMetaEmail({
                    email: 'user@example.com',
                  })
                } else if (avdlType === RPCTypes.HomeScreenTodoType.verifyAllPhoneNumber) {
                  metadata = makeTodoMetaPhone({
                    phone: '+1555000111',
                  })
                }
                newItems.push(
                  makeTodo({
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
                makeFollowedNotificationItem({
                  badged: true,
                  newFollows: [
                    makeFollowedNotification({
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
                  makeFollowSuggestion({
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

            set(s => {
              if (!isEqual(followSuggestions, s.followSuggestions)) {
                s.followSuggestions = followSuggestions
              }
              if (!isEqual(newItems, s.newItems)) {
                s.newItems = newItems
              }
              if (!isEqual(oldItems, s.oldItems)) {
                s.oldItems = oldItems
              }
            })
            // never throw black bars
          } catch (_) {}
        }
        Z.ignorePromise(f())
      },
      markViewed: () => {
        const f = async () => {
          try {
            await RPCTypes.homeHomeMarkViewedRpcPromise()
          } catch (error) {
            if (!(error instanceof RPCError)) {
              throw error
            }
            if (isNetworkErr(error.code)) {
              logger.warn('Network error calling homeMarkViewed')
            } else {
              throw error
            }
          }
        }
        Z.ignorePromise(f())
      },
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
      setResentEmail: (email: string) => {
        set(s => {
          s.resentEmail = email
        })
      },
      skipTodo: (type: Types.TodoType) => {
        const f = async () => {
          try {
            await RPCTypes.homeHomeSkipTodoTypeRpcPromise({
              t: RPCTypes.HomeScreenTodoType[type],
            })
            // TODO get rid of this load and have core send us a homeUIRefresh
            get().dispatch.loadPeople(false)
          } catch (_) {}
        }
        Z.ignorePromise(f())
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)
