import * as I from 'immutable'
import * as Types from './types/people'
import * as RPCTypes from './types/rpc-gen'
import {invert} from 'lodash-es'
import {IconType} from '../common-adapters/icon.constants' // do NOT pull in all of common-adapters
import {isMobile} from '../constants/platform'
import {e164ToDisplay} from '../util/phone-numbers'

export const defaultNumFollowSuggestions = 10
export const getPeopleDataWaitingKey = 'getPeopleData'

export const todoTypeEnumToType = invert(RPCTypes.HomeScreenTodoType) as {
  [K in Types.TodoTypeEnum]: Types.TodoType
}

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

export const todoTypeToInstructions: {[K in Types.TodoType]: string} = {
  addEmail: 'Add an email address for security purposes, and to get important notifications.',
  addPhoneNumber: 'Add your phone number so your friends can find you.',
  annoncementPlaceholder: '',
  avatarTeam: 'NEW! Change your team’s avatar from within the Keybase app.',
  avatarUser: 'NEW! Change your avatar from within the Keybase app.',
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
  team:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out the team settings on any team you manage.`,
  verifyAllEmail: '',
  verifyAllPhoneNumber: '',
}
export const todoTypeToConfirmLabel: {[K in Types.TodoType]: string} = {
  addEmail: 'Add email',
  addPhoneNumber: 'Add number',
  annoncementPlaceholder: '',
  avatarTeam: 'Edit team avatar',
  avatarUser: 'Edit avatar',
  bio: 'Edit Profile',
  chat: 'Start a chat',
  device: isMobile ? 'Get the download link' : 'Get the app',
  folder: 'Open a private folder',
  follow: '',
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

export const todoTypeToIcon: {[K in Types.TodoType]: IconType} = {
  addEmail: 'icon-onboarding-email-add-48',
  addPhoneNumber: 'icon-onboarding-phone-48',
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

export function makeDescriptionForTodoItem(todo: RPCTypes.HomeScreenTodo) {
  const T = RPCTypes.HomeScreenTodoType
  switch (todo.t) {
    case T.legacyEmailVisibility:
      return `Allow friends to find you using *${todo.legacyEmailVisibility}*?`
    case T.verifyAllEmail:
      return `Your email address *${todo.verifyAllEmail}* is unverified.`
    case T.verifyAllPhoneNumber: {
      const p = todo.verifyAllPhoneNumber
      return `Your number *${p ? e164ToDisplay(p) : ''}* is unverified.`
    }
    default: {
      // @ts-ignore this variant compilation seems wrong. ts todo.t can only be
      // of 3 types but that's not what we do in avdl.
      const type = todoTypeEnumToType[todo.t]
      return todoTypeToInstructions[type]
    }
  }
}

export function extractMetaFromTodoItem(todo: RPCTypes.HomeScreenTodo) {
  const T = RPCTypes.HomeScreenTodoType
  switch (todo.t) {
    case T.legacyEmailVisibility:
      return makeTodoMetaEmail({email: todo.legacyEmailVisibility || ''})
    case T.verifyAllEmail:
      return makeTodoMetaEmail({email: todo.verifyAllEmail || ''})
    case T.verifyAllPhoneNumber:
      return makeTodoMetaPhone({phone: todo.verifyAllPhoneNumber || ''})
    default:
      return null
  }
}

export const reduceRPCItemToPeopleItem = (
  list: I.List<Types.PeopleScreenItem>,
  item: RPCTypes.HomeScreenItem
): I.List<Types.PeopleScreenItem> => {
  const badged = item.badged
  if (item.data.t === RPCTypes.HomeScreenItemType.todo) {
    const todo = item.data.todo
    if (!todo) {
      return list
    }
    const todoType = todoTypeEnumToType[todo.t || 0]
    const metadata: Types.TodoMeta = extractMetaFromTodoItem(todo)
    return list.push(
      makeTodo({
        badged: badged,
        confirmLabel: todoTypeToConfirmLabel[todoType],
        icon: todoTypeToIcon[todoType],
        instructions: makeDescriptionForTodoItem(todo),
        metadata,
        todoType,
        type: 'todo',
      })
    )
  } else if (item.data.t === RPCTypes.HomeScreenItemType.people) {
    // Follow notification
    const notification = item.data.people
    if (notification && notification.t === RPCTypes.HomeScreenPeopleNotificationType.followed) {
      // Single follow notification
      const follow = notification.followed
      if (!follow) {
        return list
      }
      return list.push(
        makeFollowedNotificationItem({
          badged,
          newFollows: [makeFollowedNotification({username: follow.user.username})],
          notificationTime: new Date(follow.followTime),
          type: 'notification',
        })
      )
    } else if (notification && notification.t === RPCTypes.HomeScreenPeopleNotificationType.followedMulti) {
      // Multiple follows notification
      const multiFollow = notification.followedMulti
      if (!multiFollow) {
        return list
      }
      const followers = multiFollow.followers
      if (!followers) {
        return list
      }
      const notificationTimes = followers.map(follow => follow.followTime)
      const maxNotificationTime = Math.max(...notificationTimes)
      const notificationTime = new Date(maxNotificationTime)
      return list.push(
        makeFollowedNotificationItem({
          badged,
          newFollows: followers.map(follow =>
            makeFollowedNotification({
              username: follow.user.username,
            })
          ),
          notificationTime,
          numAdditional: multiFollow.numOthers,
          type: 'notification',
        })
      )
    }
  } else if (item.data.t === RPCTypes.HomeScreenItemType.announcement) {
    const a = item.data.announcement
    if (a) {
      return list.push(
        makeAnnouncement({
          appLink: a.appLink,
          badged,
          confirmLabel: a.confirmLabel,
          dismissable: a.dismissable,
          iconUrl: a.iconUrl,
          id: a.id,
          text: a.text,
          url: a.url,
        })
      )
    }
  }

  return list
}

export const makeAnnouncement = I.Record<Types._Announcement>({
  appLink: null,
  badged: false,
  confirmLabel: null,
  dismissable: false,
  iconUrl: '',
  id: 0,
  text: '',
  type: 'announcement',
  url: null,
})

export const makeTodo = I.Record<Types._Todo>({
  badged: false,
  confirmLabel: '',
  dismissable: false,
  icon: 'iconfont-close',
  instructions: '',
  metadata: null,
  todoType: 'none',
  type: 'todo',
})

export const makeFollowedNotification = I.Record<Types._FollowedNotification>({
  username: '',
})

export const makeFollowedNotificationItem = I.Record<Types._FollowedNotificationItem>({
  badged: false,
  newFollows: [],
  notificationTime: new Date(),
  numAdditional: 0,
  type: 'notification',
})

export const makeFollowSuggestion = I.Record<Types._FollowSuggestion>({
  followsMe: false,
  fullName: null,
  iFollow: false,
  username: '',
})

export const makeState = I.Record<Types._State>({
  followSuggestions: I.List(),
  lastViewed: new Date(),
  newItems: I.List(),
  oldItems: I.List(),
  version: -1,
})

export const makeTodoMetaEmail = I.Record<Types._TodoMetaEmail>({email: '', type: 'email'})
export const makeTodoMetaPhone = I.Record<Types._TodoMetaPhone>({phone: '', type: 'phone'})
