import * as C from '@/constants'
import {ignorePromise} from '@/constants/utils'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters
import {isMobile} from '@/constants/platform'
import type {DebouncedFunc} from 'lodash'
import debounce from 'lodash/debounce'
import invert from 'lodash/invert'
import isEqual from 'lodash/isEqual'
import People from '.'
import * as T from '@/constants/types'
import {useFollowerState} from '@/stores/followers'
import {useSignupState} from '@/stores/signup'
import {useProfileState} from '@/stores/profile'
import {usePeopleState} from '@/stores/people'
import {useCurrentUserState} from '@/stores/current-user'
import type {e164ToDisplay as e164ToDisplayType} from '@/util/phone-numbers'

const getPeopleDataWaitingKey = 'getPeopleData'
const waitToRefresh = 1000 * 60 * 5
const defaultNumFollowSuggestions = 10

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

const maxDate = (times: Array<number>) => new Date(Math.max(...times))
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
        lastVerifyEmailDate: todoExt?.t === t.verifyAllEmail ? todoExt.verifyAllEmail.lastVerifyEmailDate : 0,
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
      list.push(
        makeTodo({
          badged,
          confirmLabel: todoTypeToConfirmLabel[todoType],
          icon: todoTypeToIcon[todoType],
          instructions: makeDescriptionForTodoItem(todo),
          metadata,
          todoType,
          type: 'todo',
        })
      )
      return list
    }
    case T.RPCGen.HomeScreenItemType.people: {
      const notification = item.data.people
      switch (notification.t) {
        case T.RPCGen.HomeScreenPeopleNotificationType.followed: {
          const follow = notification.followed
          list.push(
            makeFollowedNotificationItem({
              badged,
              newFollows: [makeFollowedNotification({username: follow.user.username})],
              notificationTime: new Date(follow.followTime),
              type: 'follow',
            })
          )
          return list
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.followedMulti: {
          const multiFollow = notification.followedMulti
          const followers = multiFollow.followers
          if (!followers) {
            return list
          }
          list.push(
            makeFollowedNotificationItem({
              badged,
              newFollows: followers.map(follow => makeFollowedNotification({username: follow.user.username})),
              notificationTime: maxDate(followers.map(f => f.followTime)),
              numAdditional: multiFollow.numOthers,
              type: 'follow',
            })
          )
          return list
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.contact: {
          const follow = notification.contact
          list.push(
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
            })
          )
          return list
        }
        case T.RPCGen.HomeScreenPeopleNotificationType.contactMulti: {
          const multiContact = notification.contactMulti
          const contacts = multiContact.contacts
          if (!contacts) {
            return list
          }
          list.push(
            makeFollowedNotificationItem({
              badged,
              newFollows: contacts.map(c =>
                makeFollowedNotification({
                  contactDescription: c.description,
                  username: c.username,
                })
              ),
              notificationTime: maxDate(contacts.map(c => c.resolveTime)),
              numAdditional: multiContact.numOthers,
              type: 'contact',
            })
          )
          return list
        }
        default:
          return list
      }
    }
    case T.RPCGen.HomeScreenItemType.announcement: {
      const a = item.data.announcement
      list.push(
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
      return list
    }
  }
}

const reducePeopleScreenData = (
  data: Pick<T.RPCGen.HomeScreen, 'followSuggestions' | 'items'>,
  followers: ReadonlySet<string>,
  following: ReadonlySet<string>
) => {
  const oldItems: Array<T.People.PeopleScreenItem> = []
  const newItems: Array<T.People.PeopleScreenItem> = []
  for (const item of data.items ?? []) {
    const isNew = item.badged || item.data.t === T.RPCGen.HomeScreenItemType.todo
    reduceRPCItemToPeopleItem(isNew ? newItems : oldItems, item)
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

  return {followSuggestions, newItems, oldItems}
}

const usePeoplePageState = () => {
  const [followSuggestions, setFollowSuggestions] = React.useState<Array<T.People.FollowSuggestion>>([])
  const [newItems, setNewItems] = React.useState<Array<T.People.PeopleScreenItem>>([])
  const [oldItems, setOldItems] = React.useState<Array<T.People.PeopleScreenItem>>([])
  const [resentEmail, setResentEmail] = React.useState('')
  const {followers, following} = useFollowerState(
    C.useShallow(s => ({
      followers: s.followers,
      following: s.following,
    }))
  )
  const dismissAnnouncementRPC = C.useRPC(T.RPCGen.homeHomeDismissAnnouncementRpcPromise)
  const skipTodoRPC = C.useRPC(T.RPCGen.homeHomeSkipTodoTypeRpcPromise)
  const mountedRef = React.useRef(true)
  const debouncedLoadPeopleRef = React.useRef<DebouncedFunc<
    (markViewed: boolean, numFollowSuggestionsWanted?: number) => void
  > | null>(null)

  const loadPeople = React.useEffectEvent(
    (markViewed: boolean, numFollowSuggestionsWanted: number = defaultNumFollowSuggestions) => {
      const f = async () => {
        try {
          const data = await T.RPCGen.homeHomeGetScreenRpcPromise(
            {markViewed, numFollowSuggestionsWanted},
            getPeopleDataWaitingKey
          )
          if (!mountedRef.current) {
            return
          }

          const nextState = reducePeopleScreenData(data, followers, following)
          setFollowSuggestions(s =>
            isEqual(s, nextState.followSuggestions) ? s : nextState.followSuggestions
          )
          setNewItems(s => (isEqual(s, nextState.newItems) ? s : nextState.newItems))
          setOldItems(s => (isEqual(s, nextState.oldItems) ? s : nextState.oldItems))
        } catch {
          // Keep People resilient to transient RPC failures.
        }
      }
      ignorePromise(f())
    }
  )

  if (debouncedLoadPeopleRef.current == null) {
    debouncedLoadPeopleRef.current = debounce(
      (markViewed: boolean, numFollowSuggestionsWanted: number = defaultNumFollowSuggestions) => {
        loadPeople(markViewed, numFollowSuggestionsWanted)
      },
      1000,
      {leading: true, trailing: false}
    )
  }

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      debouncedLoadPeopleRef.current?.cancel()
    }
  }, [])

  const dismissAnnouncement = (id: T.RPCGen.HomeScreenAnnouncementID) => {
    dismissAnnouncementRPC(
      [{i: id}],
      () => {},
      _ => {}
    )
  }

  const queueLoadPeople = (
    markViewed: boolean,
    numFollowSuggestionsWanted: number = defaultNumFollowSuggestions
  ) => {
    debouncedLoadPeopleRef.current?.(markViewed, numFollowSuggestionsWanted)
  }

  const skipTodo = (type: T.People.TodoType) => {
    skipTodoRPC(
      [{t: T.RPCGen.HomeScreenTodoType[type]}],
      () => {
        mountedRef.current && queueLoadPeople(false)
      },
      _ => {}
    )
  }

  return {
    dismissAnnouncement,
    followSuggestions,
    loadPeople: queueLoadPeople,
    newItems,
    oldItems,
    resentEmail,
    setResentEmail,
    skipTodo,
  }
}

const PeopleReloadable = () => {
  const {
    dismissAnnouncement,
    followSuggestions,
    loadPeople,
    newItems,
    oldItems,
    resentEmail,
    setResentEmail,
    skipTodo,
  } = usePeoplePageState()
  const refreshCount = usePeopleState(s => s.refreshCount)
  const username = useCurrentUserState(s => s.username)
  const signupEmail = useSignupState(s => s.justSignedUpEmail)
  const waiting = C.Waiting.useAnyWaiting(getPeopleDataWaitingKey)
  const lastRefreshRef = React.useRef(0)
  const lastSeenRefreshRef = React.useRef(refreshCount)
  const didInitialLoadRef = React.useRef(false)

  const getData = React.useEffectEvent((markViewed = true, force = false) => {
    const now = Date.now()
    if (force || !lastRefreshRef.current || lastRefreshRef.current + waitToRefresh < now) {
      lastRefreshRef.current = now
      loadPeople(markViewed, 10)
    }
  })

  React.useEffect(() => {
    if (refreshCount !== lastSeenRefreshRef.current) {
      lastSeenRefreshRef.current = refreshCount
      getData(false, true)
    }
  }, [refreshCount])

  React.useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true
      getData(false, true)
    }
  }, [])

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)

  const onClickUser = (username: string) => showUserProfile(username)

  const onReload = (isRetry?: boolean) => getData(false, isRetry === true || !followSuggestions.length)

  C.Router2.useSafeFocusEffect(onReload)

  return (
    <Kb.Reloadable onReload={onReload} reloadOnMount={false} waitingKeys={getPeopleDataWaitingKey}>
      <People
        followSuggestions={followSuggestions}
        getData={getData}
        myUsername={username}
        newItems={newItems}
        oldItems={oldItems}
        onClickUser={onClickUser}
        dismissAnnouncement={dismissAnnouncement}
        resentEmail={resentEmail}
        setResentEmail={setResentEmail}
        signupEmail={signupEmail}
        skipTodo={skipTodo}
        waiting={waiting}
        // wotUpdates={wotUpdates}
      />
    </Kb.Reloadable>
  )
}
export default PeopleReloadable
