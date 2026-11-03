/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {threadWrapper} from '@/test/thread-tree'
import Rekey from './container'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const showPendingRekeyStatus = 'keybase.1.rekey.showPendingRekeyStatus'

let fake: FakeEngine

const renderRekey = () => {
  metasReceived([{...makeConversationMeta(), conversationIDKey, rekeyers: new Set(['testuser'])}], undefined, {
    force: true,
  })
  render(<Rekey />, {wrapper: threadWrapper(conversationIDKey).wrapper})
}

beforeEach(() => {
  fake = installFakeEngine()
  fake.answer(showPendingRekeyStatus, () => {})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('rekeying asks the service to show the pending rekey', async () => {
  renderRekey()
  act(() => {
    fireEvent.click(screen.getByText('Rekey'))
  })
  await flush()
  expect(paramsOf(fake, showPendingRekeyStatus)).toEqual([{}])
})

// an account switch retires the thread at once, but the screen stays up until React rebuilds it for
// the next account: a click landing in between reaches the old screen's button
test('a screen whose thread has retired asks for no rekey', async () => {
  renderRekey()
  act(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id2',
      deviceName: 'testuser-mac',
      uid: 'uid2',
      username: 'testuser2',
    })
    fireEvent.click(screen.getByText('Rekey'))
  })
  await flush()
  expect(paramsOf(fake, showPendingRekeyStatus)).toEqual([])
})
