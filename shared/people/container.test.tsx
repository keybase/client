/// <reference types="jest" />
import * as T from '@/constants/types'
import {reducePeopleScreenData, reduceRPCItemToPeopleItem} from './container'

type Item = T.RPCGen.HomeScreenItem

const peopleDataExt = {t: T.RPCGen.HomeScreenItemType.people} as Item['dataExt']

const todoItem = (todoType: T.RPCGen.HomeScreenTodoType, badged: boolean, extra?: object): Item =>
  ({
    badged,
    data: {t: T.RPCGen.HomeScreenItemType.todo, todo: {t: todoType, ...extra}},
    dataExt: peopleDataExt,
  }) as Item

const followedItem = (username: string, followTime: number, badged: boolean): Item =>
  ({
    badged,
    data: {
      people: {
        followed: {followTime, user: {uid: username, username}},
        t: T.RPCGen.HomeScreenPeopleNotificationType.followed,
      },
      t: T.RPCGen.HomeScreenItemType.people,
    },
    dataExt: peopleDataExt,
  }) as Item

const followedMultiItem = (
  followers: Array<{followTime: number; username: string}> | undefined,
  numOthers: number
): Item =>
  ({
    badged: true,
    data: {
      people: {
        followedMulti: {
          followers: followers?.map(f => ({followTime: f.followTime, user: {uid: f.username, ...f}})),
          numOthers,
        },
        t: T.RPCGen.HomeScreenPeopleNotificationType.followedMulti,
      },
      t: T.RPCGen.HomeScreenItemType.people,
    },
    dataExt: peopleDataExt,
  }) as Item

const contactItem = (username: string, description: string, resolveTime: number): Item =>
  ({
    badged: true,
    data: {
      people: {
        contact: {description, resolveTime, username},
        t: T.RPCGen.HomeScreenPeopleNotificationType.contact,
      },
      t: T.RPCGen.HomeScreenItemType.people,
    },
    dataExt: peopleDataExt,
  }) as Item

const contactMultiItem = (
  contacts: Array<{description: string; resolveTime: number; username: string}> | undefined,
  numOthers: number
): Item =>
  ({
    badged: false,
    data: {
      people: {
        contactMulti: {contacts, numOthers},
        t: T.RPCGen.HomeScreenPeopleNotificationType.contactMulti,
      },
      t: T.RPCGen.HomeScreenItemType.people,
    },
    dataExt: peopleDataExt,
  }) as Item

const announcementItem = (badged: boolean): Item =>
  ({
    badged,
    data: {
      announcement: {
        appLink: T.RPCGen.AppLinkType.people,
        confirmLabel: 'Go',
        dismissable: true,
        iconUrl: 'https://example.com/i.png',
        id: 42,
        text: 'hello',
        url: 'https://example.com',
      },
      t: T.RPCGen.HomeScreenItemType.announcement,
    },
    dataExt: peopleDataExt,
  }) as Item

const reduceOne = (item: Item) => reduceRPCItemToPeopleItem([], item)

const suggestion = (username: string, fullName: string): T.RPCGen.HomeUserSummary => ({
  bio: '',
  fullName,
  uid: `uid-${username}`,
  username,
})

describe('reduceRPCItemToPeopleItem', () => {
  test('pushes onto the list it is given and returns that same list', () => {
    const list: Array<T.People.PeopleScreenItem> = []
    const out = reduceRPCItemToPeopleItem(list, todoItem(T.RPCGen.HomeScreenTodoType.bio, false))
    expect(out).toBe(list)
    expect(list).toHaveLength(1)
    reduceRPCItemToPeopleItem(list, todoItem(T.RPCGen.HomeScreenTodoType.proof, false))
    expect(list.map(i => (i.type === 'todo' ? i.todoType : undefined))).toEqual(['bio', 'proof'])
  })

  test('a todo carries its icon, confirm label, instructions and badged flag', () => {
    const item = reduceOne(todoItem(T.RPCGen.HomeScreenTodoType.paperkey, true))[0]!
    expect(item).toEqual(
      expect.objectContaining({
        badged: true,
        confirmLabel: 'Create a paper key',
        dismissable: false,
        icon: 'icon-onboarding-paper-key-48',
        todoType: 'paperkey',
        type: 'todo',
      })
    )
    expect(item.type === 'todo' && item.instructions).toContain('paper key')
    expect(item.type === 'todo' && item.metadata).toBeUndefined()
  })

  test('platform dependent todo copy uses the desktop variant under the test globals', () => {
    const device = reduceOne(todoItem(T.RPCGen.HomeScreenTodoType.device, false))[0]!
    expect(device).toEqual(
      expect.objectContaining({confirmLabel: 'Get the app', icon: 'icon-onboarding-phone-48'})
    )
    expect(device.type === 'todo' && device.instructions).toContain('on your phone')
  })

  test('a legacyEmailVisibility todo interpolates the address and reports email metadata', () => {
    const item = reduceOne(
      todoItem(T.RPCGen.HomeScreenTodoType.legacyEmailVisibility, true, {
        legacyEmailVisibility: 'testuser@example.com',
      })
    )[0]!
    expect(item.type === 'todo' && item.instructions).toBe(
      'Allow friends to find you using *testuser@example.com*?'
    )
    expect(item.type === 'todo' && item.metadata).toEqual({
      email: 'testuser@example.com',
      lastVerifyEmailDate: 0,
      type: 'email',
    })
  })

  test('an unverified email todo pulls lastVerifyEmailDate out of the matching ext data', () => {
    const item = reduceOne({
      badged: true,
      data: {
        t: T.RPCGen.HomeScreenItemType.todo,
        todo: {t: T.RPCGen.HomeScreenTodoType.verifyAllEmail, verifyAllEmail: 'testuser@example.com'},
      },
      dataExt: {
        t: T.RPCGen.HomeScreenItemType.todo,
        todo: {
          t: T.RPCGen.HomeScreenTodoType.verifyAllEmail,
          verifyAllEmail: {lastVerifyEmailDate: 1234},
        },
      },
    } as Item)[0]!
    expect(item.type === 'todo' && item.metadata).toEqual({
      email: 'testuser@example.com',
      lastVerifyEmailDate: 1234,
      type: 'email',
    })
    expect(item.type === 'todo' && item.instructions).toBe(
      'Your email address *testuser@example.com* is unverified.'
    )
  })

  test('an unverified email todo falls back to 0 when the ext data is for something else', () => {
    const item = reduceOne(
      todoItem(T.RPCGen.HomeScreenTodoType.verifyAllEmail, true, {verifyAllEmail: 'testuser@example.com'})
    )[0]!
    expect(item.type === 'todo' && item.metadata).toEqual({
      email: 'testuser@example.com',
      lastVerifyEmailDate: 0,
      type: 'email',
    })
  })

  test('an unverified phone todo formats the e164 number and reports phone metadata', () => {
    const item = reduceOne(
      todoItem(T.RPCGen.HomeScreenTodoType.verifyAllPhoneNumber, true, {
        verifyAllPhoneNumber: '+12015550123',
      })
    )[0]!
    expect(item.type === 'todo' && item.metadata).toEqual({phone: '+12015550123', type: 'phone'})
    expect(item.type === 'todo' && item.instructions).toBe('Your number *+1 (201) 555-0123* is unverified.')
  })

  test('an unverified phone todo with no number drops the bold markup instead of emptying it', () => {
    const item = reduceOne(todoItem(T.RPCGen.HomeScreenTodoType.verifyAllPhoneNumber, true))[0]!
    expect(item.type === 'todo' && item.instructions).toBe('Your number is unverified.')
  })

  test('an unverified email todo with no address drops the bold markup instead of emptying it', () => {
    const item = reduceOne(todoItem(T.RPCGen.HomeScreenTodoType.verifyAllEmail, true))[0]!
    expect(item.type === 'todo' && item.instructions).toBe('Your email address is unverified.')
  })

  test('a legacyEmailVisibility todo with no address drops the bold markup instead of emptying it', () => {
    const item = reduceOne(todoItem(T.RPCGen.HomeScreenTodoType.legacyEmailVisibility, true))[0]!
    expect(item.type === 'todo' && item.instructions).toBe(
      'Allow friends to find you using your email address?'
    )
  })

  test('a single follow notification becomes a follow row with an empty contact description', () => {
    const item = reduceOne(followedItem('testuser', 1000, true))[0]!
    expect(item.type).toBe('follow')
    expect(item.type === 'follow' && item.newFollows).toEqual([
      {contactDescription: '', username: 'testuser'},
    ])
    expect(item.type === 'follow' && item.notificationTime.getTime()).toBe(1000)
    expect(item.type === 'follow' && item.numAdditional).toBeUndefined()
  })

  test('a multi follow collapses to one row timestamped by the newest follow', () => {
    const item = reduceOne(
      followedMultiItem(
        [
          {followTime: 1000, username: 'testuser'},
          {followTime: 5000, username: 'testuser-mac'},
          {followTime: 3000, username: 'testuser-two'},
        ],
        4
      )
    )[0]!
    expect(item.type === 'follow' && item.newFollows.map(f => f.username)).toEqual([
      'testuser',
      'testuser-mac',
      'testuser-two',
    ])
    expect(item.type === 'follow' && item.numAdditional).toBe(4)
    expect(item.type === 'follow' && item.notificationTime.getTime()).toBe(5000)
  })

  test('a multi follow with no followers is dropped entirely', () => {
    expect(reduceOne(followedMultiItem(undefined, 2))).toEqual([])
  })

  test('a contact notification keeps its description and becomes a contact row', () => {
    const item = reduceOne(contactItem('testuser', 'Test User (555)', 7000))[0]!
    expect(item.type).toBe('contact')
    expect(item.type === 'contact' && item.newFollows).toEqual([
      {contactDescription: 'Test User (555)', username: 'testuser'},
    ])
    expect(item.type === 'contact' && item.notificationTime.getTime()).toBe(7000)
  })

  test('a multi contact collapses to one row timestamped by the newest resolve', () => {
    const item = reduceOne(
      contactMultiItem(
        [
          {description: 'a', resolveTime: 10, username: 'testuser'},
          {description: 'b', resolveTime: 90, username: 'testuser-mac'},
        ],
        3
      )
    )[0]!
    expect(item.type === 'contact' && item.newFollows).toEqual([
      {contactDescription: 'a', username: 'testuser'},
      {contactDescription: 'b', username: 'testuser-mac'},
    ])
    expect(item.type === 'contact' && item.numAdditional).toBe(3)
    expect(item.type === 'contact' && item.notificationTime.getTime()).toBe(90)
  })

  test('a multi contact with no contacts is dropped entirely', () => {
    expect(reduceOne(contactMultiItem(undefined, 3))).toEqual([])
  })

  test('an unknown people notification type is dropped', () => {
    expect(
      reduceOne({
        badged: true,
        data: {people: {t: -1}, t: T.RPCGen.HomeScreenItemType.people},
        dataExt: peopleDataExt,
      } as unknown as Item)
    ).toEqual([])
  })

  test('an announcement keeps its id, link, url and dismissable flag', () => {
    const item = reduceOne(announcementItem(false))[0]!
    expect(item).toEqual({
      appLink: T.RPCGen.AppLinkType.people,
      badged: false,
      confirmLabel: 'Go',
      dismissable: true,
      iconUrl: 'https://example.com/i.png',
      id: 42,
      text: 'hello',
      type: 'announcement',
      url: 'https://example.com',
    })
  })
})

describe('reducePeopleScreenData', () => {
  const noFollow = new Set<string>()

  test('empty/missing input yields three empty lists rather than throwing', () => {
    expect(reducePeopleScreenData({followSuggestions: undefined, items: undefined}, noFollow, noFollow)).toEqual(
      {followSuggestions: [], newItems: [], oldItems: []}
    )
  })

  test('todos always land in the new section, badged or not', () => {
    const {newItems, oldItems} = reducePeopleScreenData(
      {
        followSuggestions: [],
        items: [
          todoItem(T.RPCGen.HomeScreenTodoType.bio, false),
          todoItem(T.RPCGen.HomeScreenTodoType.proof, true),
        ],
      },
      noFollow,
      noFollow
    )
    expect(newItems.map(i => (i.type === 'todo' ? i.todoType : undefined))).toEqual(['bio', 'proof'])
    expect(oldItems).toEqual([])
  })

  test('badged notifications go new, unbadged go old', () => {
    const {newItems, oldItems} = reducePeopleScreenData(
      {
        followSuggestions: [],
        items: [followedItem('testuser', 1000, true), followedItem('testuser-mac', 2000, false)],
      },
      noFollow,
      noFollow
    )
    expect(newItems).toHaveLength(1)
    expect(oldItems).toHaveLength(1)
    expect(newItems[0]?.type === 'follow' && newItems[0].newFollows[0]?.username).toBe('testuser')
    expect(oldItems[0]?.type === 'follow' && oldItems[0].newFollows[0]?.username).toBe('testuser-mac')
  })

  test('unbadged announcements go to the old section', () => {
    const {newItems, oldItems} = reducePeopleScreenData(
      {followSuggestions: [], items: [announcementItem(false), announcementItem(true)]},
      noFollow,
      noFollow
    )
    expect(oldItems.map(i => i.type)).toEqual(['announcement'])
    expect(newItems.map(i => i.type)).toEqual(['announcement'])
  })

  test('each section preserves the order the service sent', () => {
    const {newItems} = reducePeopleScreenData(
      {
        followSuggestions: [],
        items: [
          followedItem('testuser', 3000, true),
          todoItem(T.RPCGen.HomeScreenTodoType.bio, false),
          followedItem('testuser-mac', 1000, true),
        ],
      },
      noFollow,
      noFollow
    )
    expect(newItems.map(i => i.type)).toEqual(['follow', 'todo', 'follow'])
  })

  test('dropped items do not leave holes in either section', () => {
    const {newItems, oldItems} = reducePeopleScreenData(
      {
        followSuggestions: [],
        items: [followedMultiItem(undefined, 1), followedItem('testuser', 1, true), announcementItem(false)],
      },
      noFollow,
      noFollow
    )
    expect(newItems.map(i => i.type)).toEqual(['follow'])
    expect(oldItems.map(i => i.type)).toEqual(['announcement'])
  })

  test('follow suggestions are annotated with follower/following state and keep their order', () => {
    const {followSuggestions} = reducePeopleScreenData(
      {
        followSuggestions: [
          suggestion('testuser', 'Test User'),
          suggestion('testuser-mac', 'Test User Mac'),
          suggestion('testuser-two', 'Nobody'),
        ],
        items: [],
      },
      new Set(['testuser']),
      new Set(['testuser-mac'])
    )
    expect(followSuggestions).toEqual([
      {followsMe: true, fullName: 'Test User', iFollow: false, username: 'testuser'},
      {followsMe: false, fullName: 'Test User Mac', iFollow: true, username: 'testuser-mac'},
      {followsMe: false, fullName: 'Nobody', iFollow: false, username: 'testuser-two'},
    ])
  })

  test('a suggestion who both follows me and is followed by me gets both flags', () => {
    const {followSuggestions} = reducePeopleScreenData(
      {
        followSuggestions: [suggestion('testuser', 'Test User')],
        items: [],
      },
      new Set(['testuser']),
      new Set(['testuser'])
    )
    expect(followSuggestions).toEqual([
      {followsMe: true, fullName: 'Test User', iFollow: true, username: 'testuser'},
    ])
  })
})

test('a multi-follow or multi-contact with no entries is dropped rather than dated NaN', () => {
  const {newItems, oldItems} = reducePeopleScreenData(
    {followSuggestions: [], items: [followedMultiItem([], 2), contactMultiItem([], 3)]},
    new Set<string>(),
    new Set<string>()
  )

  expect(newItems).toEqual([])
  expect(oldItems).toEqual([])
})
