const mockGetConvoState = jest.fn()

jest.mock('../convostate', () => ({
  getConvoState: (...args: Array<unknown>) => mockGetConvoState(...args),
}))

import * as T from '../../constants/types'
import {resetAllStores} from '../../util/zustand'
import {useCurrentUserState} from '../current-user'
import {flushInboxRowUpdates, queueInboxRowUpdate, useInboxRowBig, useInboxRowSmall, useInboxRowsState} from '../inbox-rows'

afterEach(() => {
  mockGetConvoState.mockReset()
  jest.useRealTimers()
  resetAllStores()
})

test('queued inbox row updates flush into the row caches', () => {
  jest.useFakeTimers()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
  mockGetConvoState.mockReturnValue({
    badge: 2,
    meta: {
      channelname: 'general',
      draft: 'draft text',
      isMuted: false,
      membershipType: '',
      rekeyers: new Set(['alice']),
      resetParticipants: new Set(['bob']),
      snippetDecorated: 'hello world',
      snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
      teamname: 'team#general',
      timestamp: 1234,
      trustedState: 'requesting',
      wasFinalizedBy: '',
    },
    participants: {name: ['alice', 'bob']},
    typing: new Set(['carol']),
    unread: 1,
  })

  queueInboxRowUpdate('conv-1')
  expect(useInboxRowBig('conv-1')).toMatchObject({
    channelname: '',
    hasBadge: false,
  })

  jest.runOnlyPendingTimers()

  expect(mockGetConvoState).toHaveBeenCalledWith('conv-1')
  expect(useInboxRowBig('conv-1')).toMatchObject({
    channelname: 'general',
    hasBadge: true,
    hasDraft: true,
    hasUnread: true,
    snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
  })
  expect(useInboxRowSmall('conv-1')).toMatchObject({
    draft: 'draft text',
    hasBadge: true,
    hasResetUsers: true,
    hasUnread: true,
    isDecryptingSnippet: false,
    isLocked: true,
    isMuted: false,
    participantNeedToRekey: true,
    participants: ['bob'],
    snippet: 'hello world',
    snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
    teamDisplayName: 'team',
    timestamp: 1234,
    typingSnippet: 'carol is typing...',
    youAreReset: false,
    youNeedToRekey: true,
  })
})

test('flushInboxRowUpdates is a no-op when nothing is queued', () => {
  flushInboxRowUpdates()
  expect(useInboxRowsState.getState().rowsBig.size).toBe(0)
  expect(useInboxRowsState.getState().rowsSmall.size).toBe(0)
})
