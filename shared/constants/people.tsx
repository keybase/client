import * as I from 'immutable'
import * as Types from './types/people'
import * as RPCTypes from './types/rpc-gen'
import {invert} from 'lodash-es'
import {IconType} from '../common-adapters/icon.constants' // do NOT pull in all of common-adapters
import {isMobile} from '../constants/platform'

export const defaultNumFollowSuggestions = 10
export const getPeopleDataWaitingKey = 'getPeopleData'

export const todoTypeEnumToType = invert(RPCTypes.HomeScreenTodoType) as {
  [K in Types.TodoTypeEnum]: Types.TodoType
}

export const todoTypes: {[K in Types.TodoType]: Types.TodoType} = {
  annoncementPlaceholder: 'annoncementPlaceholder', // misspelled in protocol
  avatarTeam: 'avatarTeam',
  avatarUser: 'avatarUser',
  bio: 'bio',
  chat: 'chat',
  device: 'device',
  folder: 'folder',
  follow: 'follow',
  gitRepo: 'gitRepo',
  none: 'none',
  paperkey: 'paperkey',
  proof: 'proof',
  team: 'team',
  teamShowcase: 'teamShowcase',
}

export const todoTypeToInstructions: {[K in Types.TodoType]: string} = {
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
    'Create an encrypted Git repository! Only you will be able to decrypt any of it. And it’s so easy!',
  none: '',
  paperkey:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  proof: 'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  team:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out the team settings on any team you manage.`,
}
export const todoTypeToConfirmLabel: {[K in Types.TodoType]: string} = {
  annoncementPlaceholder: '',
  avatarTeam: 'Edit team avatar',
  avatarUser: 'Edit avatar',
  bio: 'Edit Profile',
  chat: 'Start a chat',
  device: isMobile ? 'Get the download link' : 'Get the app',
  folder: 'Open a private folder',
  follow: 'Browse people',
  gitRepo: isMobile ? 'Create a repo' : 'Create a personal git repo',
  none: '',
  paperkey: 'Create a paper key',
  proof: 'Prove your identities',
  team: 'Create a team!',
  teamShowcase: 'Set publicity settings',
}
export const todoTypeToDismissable: {[K in Types.TodoType]: boolean} = {
  annoncementPlaceholder: false,
  avatarTeam: false,
  avatarUser: false,
  bio: false,
  chat: true,
  device: true,
  folder: true,
  follow: true,
  gitRepo: true,
  none: false,
  paperkey: false,
  proof: true,
  team: true,
  teamShowcase: true,
}
export const todoTypeToIcon: {[K in Types.TodoType]: IconType} = {
  annoncementPlaceholder: 'iconfont-close',
  avatarTeam: 'icon-onboarding-team-avatar-48',
  avatarUser: 'icon-onboarding-user-avatar-48',
  bio: 'icon-onboarding-user-info-48',
  chat: 'icon-onboarding-chat-48',
  device: isMobile ? 'icon-onboarding-computer-48' : 'icon-onboarding-phone-48',
  folder: 'icon-onboarding-folder-48',
  follow: 'icon-onboarding-follow-48',
  gitRepo: 'icon-onboarding-git-48',
  none: 'iconfont-close',
  paperkey: 'icon-onboarding-paper-key-48',
  proof: 'icon-onboarding-proofs-48',
  team: 'icon-onboarding-team-48',
  teamShowcase: 'icon-onboarding-team-publicity-48',
} as const

export const reduceRPCItemToPeopleItem = (
  list: I.List<Types.PeopleScreenItem>,
  item: RPCTypes.HomeScreenItem
): I.List<Types.PeopleScreenItem> => {
  const badged = item.badged
  if (item.data.t === RPCTypes.HomeScreenItemType.todo) {
    // Todo item
    // @ts-ignore todo is actually typed as void?
    const todoType = todoTypeEnumToType[(item.data.todo && item.data.todo.t) || 0]
    return list.push(
      makeTodo({
        badged: badged,
        confirmLabel: todoTypeToConfirmLabel[todoType],
        dismissable: todoTypeToDismissable[todoType],
        icon: todoTypeToIcon[todoType],
        instructions: todoTypeToInstructions[todoType],
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
