/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Chat from '@/constants/chat'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'

// the team state behind the popup comes from cached RPC loads; the item logic only
// cares about your operations and who is still in the team
let mockTeamMembers = new Map<string, T.Teams.MemberInfo>()
let mockOperations: Partial<T.Teams.TeamOperations> = {}
jest.mock('../../team-hooks', () => ({
  useChatTeam: () => ({role: 'admin', teamname: 'keybase', yourOperations: mockOperations}),
  useChatTeamMembers: () => ({loading: false, members: mockTeamMembers, reload: async () => {}}),
}))

import {useModeration, useStorelessItems} from './hooks'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const you = 'testuser'
const them = 'testuser-mac'

let navigateAppend: jest.SpyInstance
let clearModals: jest.SpyInstance

const moderation = (p: {author: string; isTeam: boolean; numPart: number}) =>
  renderHook(() => useModeration(p.author, conversationIDKey, p.isTeam, p.numPart)).result.current

const titles = (items: ReadonlyArray<{title: string}>) => items.map(i => i.title)

beforeEach(() => {
  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => {})
  clearModals = jest.spyOn(Router, 'clearModals').mockImplementation(() => {})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: you,
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
  global.isIOS = false
  mockTeamMembers = new Map()
  mockOperations = {}
})

test('you cannot moderate yourself', () => {
  const {itemBlock, itemFilter, itemFlag, itemReport} = moderation({
    author: you,
    isTeam: false,
    numPart: 2,
  })
  expect([...itemBlock, ...itemFilter, ...itemFlag, ...itemReport]).toEqual([])
})

test('there is nobody to moderate on an authorless message', () => {
  expect(moderation({author: '', isTeam: false, numPart: 2}).itemBlock).toEqual([])
})

test('team messages offer a report instead of a block', () => {
  expect(titles(moderation({author: them, isTeam: true, numPart: 5}).itemBlock)).toEqual(['Report user'])
})

test('non team messages offer a block', () => {
  expect(titles(moderation({author: them, isTeam: false, numPart: 2}).itemBlock)).toEqual(['Block user'])
})

test('content moderation is iOS only', () => {
  const desktop = moderation({author: them, isTeam: false, numPart: 2})
  expect([...desktop.itemFilter, ...desktop.itemFlag, ...desktop.itemReport]).toEqual([])

  global.isIOS = true
  const ios = moderation({author: them, isTeam: false, numPart: 2})
  expect(titles(ios.itemFilter)).toEqual(['Filter user'])
  expect(titles(ios.itemFlag)).toEqual(['Flag content'])
  expect(titles(ios.itemReport)).toEqual(['Report user'])
})

test('iOS team messages drop the separate report entry, since the block item already reports', () => {
  global.isIOS = true
  const {itemBlock, itemReport} = moderation({author: them, isTeam: true, numPart: 5})
  expect(titles(itemBlock)).toEqual(['Report user'])
  expect(itemReport).toEqual([])
})

describe('opening the blocking modal', () => {
  test('a one on one conversation gets the single user context', () => {
    moderation({author: them, isTeam: false, numPart: 2}).itemBlock[0].onClick()
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatBlockingModal',
      params: {
        blockUserByDefault: true,
        context: 'message-popup-single',
        conversationIDKey,
        username: them,
      },
    })
  })

  test('a group conversation gets the plain context', () => {
    moderation({author: them, isTeam: false, numPart: 3}).itemBlock[0].onClick()
    expect(navigateAppend).toHaveBeenCalledWith(
      expect.objectContaining({params: expect.objectContaining({context: 'message-popup'})})
    )
  })

  test('teams never use the single user context', () => {
    moderation({author: them, isTeam: true, numPart: 2}).itemBlock[0].onClick()
    expect(navigateAppend).toHaveBeenCalledWith(
      expect.objectContaining({params: expect.objectContaining({context: 'message-popup'})})
    )
  })

  test('flagging asks the modal to preselect both flag and report', () => {
    global.isIOS = true
    moderation({author: them, isTeam: false, numPart: 2}).itemFlag[0].onClick()
    expect(navigateAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({flagUserByDefault: true, reportsUserByDefault: true}),
      })
    )
  })
})

describe('delete and kick for a team admin', () => {
  const teamID: T.Teams.TeamID = 'team-id'

  const items = (isDeleteable: boolean) => {
    mockOperations = {deleteOtherMessages: true}
    mockTeamMembers = new Map([[them, {} as T.Teams.MemberInfo]])
    const message = Chat.makeMessageText({
      author: them,
      conversationIDKey,
      id: T.Chat.numberToMessageID(1),
      isDeleteable,
      ordinal: T.Chat.numberToOrdinal(1),
    })
    const meta: T.Chat.ConversationMeta = {
      ...Chat.makeConversationMeta(),
      channelname: 'general',
      conversationIDKey,
      teamID,
      teamType: 'big',
      teamname: 'keybase',
    }
    return renderHook(() =>
      useStorelessItems({
        conversationIDKey,
        message,
        meta,
        onHidden: () => {},
        participantInfo: {all: [you, them], contactName: new Map(), name: []},
      })
    ).result.current
  }

  test('a deletable message offers both delete and kick', () => {
    const {itemDelete, itemKick} = items(true)
    expect(titles(itemDelete)).toEqual(['Delete'])
    expect(titles(itemKick)).toEqual(['Kick user'])
  })

  test('a message the server says is not deletable still offers kick', () => {
    // kicking is about the author, deleting is about the message
    const {itemDelete, itemKick} = items(false)
    expect(itemDelete).toEqual([])
    expect(titles(itemKick)).toEqual(['Kick user'])
  })
})

// Edit and Reply are the two items that put something in the composer. Reached from the
// attachment viewer the popup sits under a modal route, so without this the intent lands
// behind a modal the user cannot see past - the state is right and looks broken.
describe('composer items dismiss a covering modal', () => {
  const yourEditableMessage = () => {
    const message = Chat.makeMessageText({
      author: you,
      conversationIDKey,
      id: T.Chat.numberToMessageID(1),
      ordinal: T.Chat.numberToOrdinal(1),
    })
    const meta: T.Chat.ConversationMeta = {
      ...Chat.makeConversationMeta(),
      conversationIDKey,
      teamType: 'adhoc',
    }
    return renderHook(() =>
      useStorelessItems({
        conversationIDKey,
        message,
        meta,
        onHidden: () => {},
        participantInfo: {all: [you, them], contactName: new Map(), name: []},
      })
    ).result.current
  }

  test('Edit clears modals so the composer it just filled is visible', () => {
    const {itemEdit} = yourEditableMessage()
    expect(titles(itemEdit)).toEqual(['Edit'])
    expect(clearModals).not.toHaveBeenCalled()
    itemEdit[0].onClick()
    expect(clearModals).toHaveBeenCalledTimes(1)
  })

  test('Reply clears modals so the composer it just filled is visible', () => {
    const {itemReply} = yourEditableMessage()
    expect(titles(itemReply)).toEqual(['Reply'])
    expect(clearModals).not.toHaveBeenCalled()
    itemReply[0].onClick()
    expect(clearModals).toHaveBeenCalledTimes(1)
  })
})
