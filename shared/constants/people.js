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
  proof: 'proof',
  device: 'device',
  follow: 'follow',
  chat: 'chat',
  paperkey: 'paperkey',
  team: 'team',
  folder: 'folder',
  gitRepo: 'gitRepo',
  teamShowcase: 'teamShowcase',
  addPhoneNumber: 'addPhoneNumber',
  verifyFirstPhoneNumber: 'verifyFirstPhoneNumber',
  verifyFirstEmail: 'verifyFirstEmail'
}

export const todoTypeToInstructions: {[key: Types.TodoType]: string} = {
  avatarTeam: 'NEW! Change your team’s avatar from within the Keybase app.',
  avatarUser: 'NEW! Change your photo from within the Keybase app.',
  bio: 'Add your name, bio, and location to complete your profile.',
  proof: 'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  device: `Install Keybase on your ${
    isMobile ? 'computer' : 'phone'
  }. Until you have at least 2 devices, you risk losing data.`,
  follow:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
  chat: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
  paperkey:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  team:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  folder:
    'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
  gitRepo:
    'Create an encrypted Git repository! Only you will be able to decrypt any of it. And it’s so easy!',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out the team settings on any team you manage.`,
  addPhoneNumber:
    'NEW! Allow people to look you up with your phone number.',
  verifyFirstPhoneNumber:
    'Your phone number is still unverified.',
  verifyFirstEmail:
    'Your email address is still unverified.',
}
export const todoTypeToConfirmLabel: {[key: Types.TodoType]: string} = {
  avatarTeam: 'Edit team avatar',
  avatarUser: 'Edit avatar',
  bio: 'Edit Profile',
  proof: 'Prove your identities',
  device: isMobile ? 'Get the download link' : 'Get the app',
  follow: 'Browse people',
  chat: 'Start a chat',
  paperkey: 'Create a paper key',
  team: 'Create a team!',
  folder: 'Open a private folder',
  gitRepo: isMobile ? 'Create a repo' : 'Create a personal git repo',
  teamShowcase: 'Set publicity settings',
  addPhoneNumber: 'Add your phone number',
  verifyFirstPhoneNumber: 'Verify your phone number',
  verifyFirstEmail: 'Verify your email',
}
export const todoTypeToDismissable: {[key: Types.TodoType]: boolean} = {
  avatarTeam: false,
  avatarUser: false,
  bio: false,
  proof: true,
  device: true,
  follow: true,
  chat: true,
  paperkey: false,
  team: true,
  folder: true,
  gitRepo: true,
  teamShowcase: true,
  addPhoneNumber: true,
  verifyFirstPhoneNumber: true,
  verifyFirstEmail: true,
}
export const todoTypeToIcon: {[key: Types.TodoType]: IconType} = {
  avatarTeam: isMobile ? 'icon-onboarding-team-avatar-48' : 'icon-onboarding-team-avatar-32',
  avatarUser: isMobile ? 'icon-onboarding-user-avatar-48' : 'icon-onboarding-user-avatar-32',
  bio: isMobile ? 'icon-onboarding-user-info-48' : 'icon-onboarding-user-info-32',
  proof: isMobile ? 'icon-onboarding-proofs-48' : 'icon-onboarding-proofs-32',
  device: isMobile ? 'icon-onboarding-computer-48' : 'icon-onboarding-phone-32',
  follow: isMobile ? 'icon-onboarding-follow-48' : 'icon-onboarding-follow-32',
  chat: isMobile ? 'icon-onboarding-chat-48' : 'icon-onboarding-chat-32',
  paperkey: isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32',
  team: isMobile ? 'icon-onboarding-team-48' : 'icon-onboarding-team-32',
  folder: isMobile ? 'icon-onboarding-folder-48' : 'icon-onboarding-folder-32',
  gitRepo: isMobile ? 'icon-onboarding-git-48' : 'icon-onboarding-git-32',
  teamShowcase: isMobile ? 'icon-onboarding-team-publicity-48' : 'icon-onboarding-team-publicity-32',
  addPhoneNumber: isMobile ? 'icon-onboarding-team-publicity-48' : 'icon-onboarding-team-publicity-32',
  verifyFirstPhoneNumber: isMobile ? 'icon-proof-success.png-48' : 'icon-proof-success.png-32',
  verifyFirstEmail: isMobile ? 'icon-proof-success.png-48' : 'icon-proof-success.png-32',
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
        type: 'todo',
        badged: badged,
        todoType,
        instructions: todoTypeToInstructions[todoType],
        confirmLabel: todoTypeToConfirmLabel[todoType],
        dismissable: todoTypeToDismissable[todoType],
        icon: todoTypeToIcon[todoType],
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
          type: 'notification',
          newFollows: [makeFollowedNotification({username: follow.user.username})],
          notificationTime: new Date(follow.followTime),
          badged,
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
          type: 'notification',
          newFollows: followers.map(follow =>
            makeFollowedNotification({
              username: follow.user.username,
            })
          ),
          notificationTime,
          badged,
          numAdditional: multiFollow.numOthers,
        })
      )
    }
  }
  return list
}

export const makeTodo: I.RecordFactory<Types._Todo> = I.Record({
  type: 'todo',
  badged: false,
  todoType: 'none',
  instructions: '',
  confirmLabel: '',
  dismissable: false,
  icon: 'iconfont-close',
})

export const makeFollowedNotification: I.RecordFactory<Types._FollowedNotification> = I.Record({
  username: '',
})

export const makeFollowedNotificationItem: I.RecordFactory<Types._FollowedNotificationItem> = I.Record({
  type: 'notification',
  newFollows: [],
  notificationTime: new Date(),
  badged: false,
  numAdditional: 0,
})

export const makeFollowSuggestion: I.RecordFactory<Types._FollowSuggestion> = I.Record({
  username: '',
  fullName: null,
  followsMe: false,
  iFollow: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  lastViewed: new Date(),
  version: -1,
  oldItems: I.List(),
  newItems: I.List(),
  followSuggestions: I.List(),
})
