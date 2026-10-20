/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, render} from '@testing-library/react'
import {makeMessageAttachment} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import type {Props as FloatingMenuProps} from '@/common-adapters/floating-menu'

let menuItems: FloatingMenuProps['items'] = []
jest.mock('@/common-adapters/floating-menu', () => ({
  __esModule: true,
  default: (p: FloatingMenuProps) => {
    menuItems = p.items
    return null
  },
}))
jest.mock('../../team-hooks', () => ({
  useChatTeam: () => ({role: 'admin', teamname: '', yourOperations: {}}),
  useChatTeamMembers: () => ({loading: false, members: new Map(), reload: async () => {}}),
}))
jest.mock('../../data-hooks', () => ({
  useConversationMetadata: () => ({meta: {teamname: ''}, participants: {all: ['testuser', 'testuser-mac'], name: ['testuser', 'testuser-mac']}}),
  useConversationParticipants: () => ({all: ['testuser', 'testuser-mac'], name: ['testuser', 'testuser-mac']}),
}))

import PopAttach from './attachment'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean; isIOS: boolean}

const titlesFor = (over?: Partial<T.Chat.MessageAttachment>) => {
  const message = makeMessageAttachment({
    author: 'testuser-mac',
    conversationIDKey,
    fileName: 'doc.pdf',
    fileType: 'application/pdf',
    id: T.Chat.numberToMessageID(42),
    ordinal: T.Chat.numberToOrdinal(42),
    ...over,
  })
  render(
    <PopAttach
      conversationIDKey={conversationIDKey}
      message={message}
      onHidden={() => {}}
      ordinal={message.ordinal}
      position="top left"
      visible={true}
    />
  )
  return menuItems.map(i => (!i || i === 'Divider' ? 'Divider' : i.title))
}

beforeEach(() => {
  menuItems = []
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  resetAllStores()
  g.isMobile = false
  g.isAndroid = false
  g.isIOS = false
})

test('Android offers Download for a non-media file, in the top section', () => {
  g.isMobile = true
  g.isAndroid = true
  const titles = titlesFor()
  expect(titles).toContain('Download')
  const topSectionEnd = titles.indexOf('Divider', titles.indexOf('Divider') + 1)
  expect(titles.indexOf('Download')).toBeLessThan(topSectionEnd)
  expect(titles.filter(t => t === 'Download')).toHaveLength(1)
  expect(titles.indexOf('Download')).toBe(titles.indexOf('Share') - 1)
})

test('Android still offers Download after a Save (downloadPath set)', () => {
  g.isMobile = true
  g.isAndroid = true
  expect(titlesFor({downloadPath: '/cache/doc.pdf'})).toContain('Download')
})

test('iOS offers no Download', () => {
  g.isMobile = true
  g.isIOS = true
  expect(titlesFor()).not.toContain('Download')
})

test('desktop Download still hidden once downloaded', () => {
  expect(titlesFor()).toContain('Download')
  expect(titlesFor({downloadPath: '/dl/doc.pdf'})).not.toContain('Download')
})
