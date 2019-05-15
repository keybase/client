// @flow
import * as I from 'immutable'
import * as Types from './types/people'
import * as RPCTypes from './types/rpc-gen'
import {invert} from 'lodash-es'
import type {IconType} from '../common-adapters'
import {isMobile} from '../constants/platform'

export const defaultNumFollowSuggestions = 10
export const getPeopleDataWaitingKey = 'getPeopleData'

export const todoTypeEnumToType: {[key: Types.TodoTypeEnum]: Types.TodoType} = invert(
  RPCTypes.homeHomeScreenTodoType
)

export const todoTypes: {[key: Types.TodoType]: Types.TodoType} = {
  avatarTeam: 'avatarTeam',
  avatarUser: 'avatarUser',
  bio: 'bio',
  chat: 'chat',
  device: 'device',
  folder: 'folder',
  follow: 'follow',
  gitRepo: 'gitRepo',
  paperkey: 'paperkey',
  proof: 'proof',
  team: 'team',
  teamShowcase: 'teamShowcase',
}

export const todoTypeToInstructions: {[key: Types.TodoType]: string} = {
  avatarTeam: 'NEW! Change your team’s avatar from within the Keybase app.',
  avatarUser: 'NEW! Change your photo from within the Keybase app.',
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
  paperkey:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  proof: 'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  team:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out the team settings on any team you manage.`,
}
export const todoTypeToConfirmLabel: {[key: Types.TodoType]: string} = {
  avatarTeam: 'Edit team avatar',
  avatarUser: 'Edit avatar',
  bio: 'Edit Profile',
  chat: 'Start a chat',
  device: isMobile ? 'Get the download link' : 'Get the app',
  folder: 'Open a private folder',
  follow: 'Browse people',
  gitRepo: isMobile ? 'Create a repo' : 'Create a personal git repo',
  paperkey: 'Create a paper key',
  proof: 'Prove your identities',
  team: 'Create a team!',
  teamShowcase: 'Set publicity settings',
}
export const todoTypeToDismissable: {[key: Types.TodoType]: boolean} = {
  avatarTeam: false,
  avatarUser: false,
  bio: false,
  chat: true,
  device: true,
  folder: true,
  follow: true,
  gitRepo: true,
  paperkey: false,
  proof: true,
  team: true,
  teamShowcase: true,
}
export const todoTypeToIcon: {[key: Types.TodoType]: IconType} = {
  avatarTeam: 'icon-onboarding-team-avatar-48',
  avatarUser: 'icon-onboarding-user-avatar-48',
  bio: 'icon-onboarding-user-info-48',
  chat: 'icon-onboarding-chat-48',
  device: 'icon-onboarding-computer-48',
  folder: 'icon-onboarding-folder-48',
  follow: 'icon-onboarding-follow-48',
  gitRepo: 'icon-onboarding-git-48',
  paperkey: 'icon-onboarding-paper-key-48',
  proof: 'icon-onboarding-proofs-48',
  team: 'icon-onboarding-team-48',
  teamShowcase: 'icon-onboarding-team-publicity-48',
}

export const reduceRPCItemToPeopleItem = (
  list: I.List<Types.PeopleScreenItem>,
  item: RPCTypes.HomeScreenItem
): I.List<Types.PeopleScreenItem> => {
  const badged = item.badged
  if (item.data.t === RPCTypes.homeHomeScreenItemType.todo) {
    // Todo item
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
  } else if (item.data.t === RPCTypes.homeHomeScreenItemType.people) {
    // Follow notification
    const notification = item.data.people
    if (notification && notification.t === RPCTypes.homeHomeScreenPeopleNotificationType.followed) {
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
    } else if (
      notification &&
      notification.t === RPCTypes.homeHomeScreenPeopleNotificationType.followedMulti
    ) {
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
  } else if (item.data.t === RPCTypes.homeHomeScreenItemType.announcement) {
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

export const makeAnnouncement: I.RecordFactory<Types._Announcement> = I.Record({
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

export const makeTodo: I.RecordFactory<Types._Todo> = I.Record({
  badged: false,
  confirmLabel: '',
  dismissable: false,
  icon: 'iconfont-close',
  instructions: '',
  todoType: 'none',
  type: 'todo',
})

export const makeFollowedNotification: I.RecordFactory<Types._FollowedNotification> = I.Record({
  username: '',
})

export const makeFollowedNotificationItem: I.RecordFactory<Types._FollowedNotificationItem> = I.Record({
  badged: false,
  newFollows: [],
  notificationTime: new Date(),
  numAdditional: 0,
  type: 'notification',
})

export const makeFollowSuggestion: I.RecordFactory<Types._FollowSuggestion> = I.Record({
  followsMe: false,
  fullName: null,
  iFollow: false,
  username: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  followSuggestions: I.List(),
  lastViewed: new Date(),
  newItems: I.List(),
  oldItems: I.List(),
  version: -1,
})
