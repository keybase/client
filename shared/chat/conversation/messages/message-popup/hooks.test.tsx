/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {useModeration} from './hooks'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const you = 'testuser'
const them = 'testuser-mac'

let navigateAppend: jest.SpyInstance

const moderation = (p: {author: string; isTeam: boolean; numPart: number}) =>
  renderHook(() => useModeration(p.author, conversationIDKey, p.isTeam, p.numPart)).result.current

const titles = (items: ReadonlyArray<{title: string}>) => items.map(i => i.title)

beforeEach(() => {
  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => {})
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
