import type * as Types from './types/people'

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

export const makeAnnouncement = (a?: Partial<Types.Announcement>): Types.Announcement => ({
  badged: false,
  dismissable: false,
  iconUrl: '',
  id: 0,
  text: '',
  type: 'announcement',
  ...a,
})

export const makeTodo = (t?: Partial<Types.Todo>): Types.Todo => ({
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

export const makeFollowedNotification = (
  f?: Partial<Types.FollowedNotification>
): Types.FollowedNotification => ({
  contactDescription: '',
  username: '',
  ...f,
})

export const makeFollowedNotificationItem = (
  f?: Partial<Types.FollowedNotificationItem>
): Types.FollowedNotificationItem => ({
  badged: false,
  newFollows: [],
  notificationTime: new Date(),
  numAdditional: 0,
  type: 'follow',
  ...f,
})

export const makeFollowSuggestion = (f?: Partial<Types.FollowSuggestion>): Types.FollowSuggestion => ({
  followsMe: false,
  fullName: undefined,
  iFollow: false,
  username: '',
  ...f,
})

export const makeTodoMetaEmail = (t?: Partial<Types.TodoMetaEmail>): Types.TodoMetaEmail => ({
  email: '',
  lastVerifyEmailDate: 0,
  type: 'email',
  ...t,
})

export const makeTodoMetaPhone = (t?: Partial<Types.TodoMetaPhone>): Types.TodoMetaPhone => ({
  phone: '',
  type: 'phone',
  ...t,
})
