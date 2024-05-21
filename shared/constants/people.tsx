import * as C from '.'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import invert from 'lodash/invert'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as T from './types'
import type {IconType} from '@/common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters
import {isMobile} from './platform'
import type {e164ToDisplay as e164ToDisplayType} from '@/util/phone-numbers'

// set this to true to have all todo items + a contact joined notification show up all the time
const debugTodo = false as boolean

export const getPeopleDataWaitingKey = 'getPeopleData'

export const todoTypes: {[K in T.People.TodoType]: T.People.TodoType} = {
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

const makeAnnouncement = (a?: Partial<T.People.Announcement>): T.People.Announcement => ({
  badged: false,
  dismissable: false,
  iconUrl: '',
  id: 0,
  text: '',
  type: 'announcement',
  ...a,
})

const makeTodo = (t?: Partial<T.People.Todo>): T.People.Todo => ({
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

const makeFollowedNotification = (
  f?: Partial<T.People.FollowedNotification>
): T.People.FollowedNotification => ({
  contactDescription: '',
  username: '',
  ...f,
})

const makeFollowedNotificationItem = (
  f?: Partial<T.People.FollowedNotificationItem>
): T.People.FollowedNotificationItem => ({
  badged: false,
  newFollows: [],
  notificationTime: new Date(),
  numAdditional: 0,
  type: 'follow',
  ...f,
})

const makeFollowSuggestion = (f?: Partial<T.People.FollowSuggestion>): T.People.FollowSuggestion => ({
  followsMe: false,
  fullName: undefined,
  iFollow: false,
  username: '',
  ...f,
})

const makeTodoMetaEmail = (t?: Partial<T.People.TodoMetaEmail>): T.People.TodoMetaEmail => ({
  email: '',
  lastVerifyEmailDate: 0,
  type: 'email',
  ...t,
})

const makeTodoMetaPhone = (t?: Partial<T.People.TodoMetaPhone>): T.People.TodoMetaPhone => ({
  phone: '',
  type: 'phone',
  ...t,
})

export const defaultNumFollowSuggestions = 10
const todoTypeEnumToType = invert(T.RPCGen.HomeScreenTodoType) as {
  [K in T.People.TodoTypeEnum]: T.People.TodoType
}

const todoTypeToInstructions: {[K in T.People.TodoType]: string} = {
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

const todoTypeToIcon: {[K in T.People.TodoType]: IconType} = {
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

const todoTypeToConfirmLabel: {[K in T.People.TodoType]: string} = {
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

const makeDescriptionForTodoItem = (todo: T.RPCGen.HomeScreenTodo) => {
  const t = T.RPCGen.HomeScreenTodoType
  switch (todo.t) {
    case t.legacyEmailVisibility:
      return `Allow friends to find you using *${todo.legacyEmailVisibility}*?`
    case t.verifyAllEmail:
      return `Your email address *${todo.verifyAllEmail}* is unverified.`
    case t.verifyAllPhoneNumber: {
      const {e164ToDisplay} = require('@/util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
      const p = todo.verifyAllPhoneNumber
      return `Your number *${p ? e164ToDisplay(p) : ''}* is unverified.`
    }
    default: {
      const type = todoTypeEnumToType[todo.t]
      return todoTypeToInstructions[type]
    }
  }
}

const extractMetaFromTodoItem = (todo: T.RPCGen.HomeScreenTodo, todoExt?: T.RPCGen.HomeScreenTodoExt) => {
  const t = T.RPCGen.HomeScreenTodoType
  switch (todo.t) {
    case t.legacyEmailVisibility:
      return makeTodoMetaEmail({email: todo.legacyEmailVisibility})
    case t.verifyAllEmail:
      return makeTodoMetaEmail({
        email: todo.verifyAllEmail || '',
        lastVerifyEmailDate:
          todoExt && todoExt.t === t.verifyAllEmail ? todoExt.verifyAllEmail.lastVerifyEmailDate : 0,
      })
    case t.verifyAllPhoneNumber:
      return makeTodoMetaPhone({phone: todo.verifyAllPhoneNumber})
    default:
      return
  }
}

const reduceRPCItemToPeopleItem = (
  list: Array<T.People.PeopleScreenItem>,
  item: T.RPCGen.HomeScreenItem
): Array<T.People.PeopleScreenItem> => {
  const badged = item.badged
  switch (item.data.t) {
    case T.RPCGen.HomeScreenItemType.todo: {
      const todo = item.data.todo
      const todoExt: T.RPCGen.HomeScreenTodoExt | undefined =
        item.dataExt.t === T.RPCGen.HomeScreenItemType.todo ? item.dataExt.todo : undefined

      const todoType = todoTypeEnumToType[todo.t || 0]
      const metadata: T.People.TodoMeta = extractMetaFromTodoItem(todo, todoExt)
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
    }
    case T.RPCGen.HomeScreenItemType.people: {
      // Follow notification or contact resolution
      const notification = item.data.people
      switch (notification.t) {
        case T.RPCGen.HomeScreenPeopleNotificationType.followed: {
          // Single follow notification
          const follow = notification.followed
          return [
            ...list,
            makeFollowedNotificationItem({
              badged,
              newFollows: [makeFollowedNotification({username: follow.user.username})],
              notificationTime: new Date(follow.followTime),
              type: 'follow',
            }),
          ]
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.followedMulti: {
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
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.contact: {
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
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.contactMulti: {
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
        default:
          return list
      }
    }
    case T.RPCGen.HomeScreenItemType.announcement: {
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
  }
}

type Store = T.Immutable<{
  followSuggestions: Array<T.People.FollowSuggestion>
  newItems: Array<T.People.PeopleScreenItem>
  oldItems: Array<T.People.PeopleScreenItem>
  resentEmail: string
}>
const initialStore: Store = {
  followSuggestions: [],
  newItems: [],
  oldItems: [],
  resentEmail: '',
}

interface State extends Store {
  dispatch: {
    dismissAnnouncement: (id: T.RPCGen.HomeScreenAnnouncementID) => void
    loadPeople: (markViewed: boolean, numFollowSuggestionsWanted?: number) => void
    onEngineConnected: () => void
    setResentEmail: (email: string) => void
    skipTodo: (type: T.People.TodoType) => void
    markViewed: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    dismissAnnouncement: id => {
      const f = async () => {
        await T.RPCGen.homeHomeDismissAnnouncementRpcPromise({
          i: id,
        })
      }
      C.ignorePromise(f())
    },
    loadPeople: (markViewed, numFollowSuggestionsWanted = defaultNumFollowSuggestions) => {
      const f = async () => {
        // more logging to understand why this fails so much
        logger.info(
          'getPeopleData: appFocused:',
          'loggedIn',
          C.useConfigState.getState().loggedIn,
          'action',
          {markViewed, numFollowSuggestionsWanted}
        )

        try {
          const data = await T.RPCGen.homeHomeGetScreenRpcPromise(
            {markViewed, numFollowSuggestionsWanted},
            getPeopleDataWaitingKey
          )
          const {following, followers} = C.useFollowerState.getState()
          const oldItems: Array<T.People.PeopleScreenItem> = (data.items ?? [])
            .filter(item => !item.badged && item.data.t !== T.RPCGen.HomeScreenItemType.todo)
            .reduce(reduceRPCItemToPeopleItem, [])
          const newItems: Array<T.People.PeopleScreenItem> = (data.items ?? [])
            .filter(item => item.badged || item.data.t === T.RPCGen.HomeScreenItemType.todo)
            .reduce(reduceRPCItemToPeopleItem, [])

          if (debugTodo) {
            const allTodos = Object.values(T.RPCGen.HomeScreenTodoType).reduce<
              Array<T.RPCGen.HomeScreenTodoType>
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
              let metadata: T.People.TodoMetaEmail | T.People.TodoMetaPhone | undefined
              if (
                avdlType === T.RPCGen.HomeScreenTodoType.verifyAllEmail ||
                avdlType === T.RPCGen.HomeScreenTodoType.legacyEmailVisibility
              ) {
                metadata = makeTodoMetaEmail({
                  email: 'user@example.com',
                })
              } else if (avdlType === T.RPCGen.HomeScreenTodoType.verifyAllPhoneNumber) {
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

          const followSuggestions = (data.followSuggestions ?? []).reduce<Array<T.People.FollowSuggestion>>(
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
              s.newItems = T.castDraft(newItems)
            }
            if (!isEqual(oldItems, s.oldItems)) {
              s.oldItems = T.castDraft(oldItems)
            }
          })
          // never throw black bars
        } catch {}
      }
      C.ignorePromise(f())
    },
    markViewed: () => {
      const f = async () => {
        try {
          await T.RPCGen.homeHomeMarkViewedRpcPromise()
        } catch (error) {
          if (!(error instanceof C.RPCError)) {
            throw error
          }
          if (C.isNetworkErr(error.code)) {
            logger.warn('Network error calling homeMarkViewed')
          } else {
            throw error
          }
        }
      }
      C.ignorePromise(f())
    },
    onEngineConnected: () => {
      const f = async () => {
        try {
          await T.RPCGen.delegateUiCtlRegisterHomeUIRpcPromise()
          console.log('Registered home UI')
        } catch (error) {
          console.warn('Error in registering home UI:', error)
        }
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1HomeUIHomeUIRefresh:
          get().dispatch.loadPeople(false)
          break
        case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
          get().dispatch.setResentEmail(action.payload.params.emailAddress)
          break
        default:
      }
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
      }))
    },
    setResentEmail: email => {
      set(s => {
        s.resentEmail = email
      })
    },
    skipTodo: type => {
      const f = async () => {
        try {
          await T.RPCGen.homeHomeSkipTodoTypeRpcPromise({
            t: T.RPCGen.HomeScreenTodoType[type],
          })
          // TODO get rid of this load and have core send us a homeUIRefresh
          get().dispatch.loadPeople(false)
        } catch {}
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
