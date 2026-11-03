/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// each button's first onClick: the handler a screen kept through an account switch still holds
const mockFirstOnClick = new Map<string, () => void>()
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{Button: React.ComponentType<{label?: string; onClick?: () => void}>}>(
    '@/common-adapters'
  )
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Button: (p: {label?: string; onClick?: () => void}) => {
      if (p.label && p.onClick && !mockFirstOnClick.has(p.label)) {
        mockFirstOnClick.set(p.label, p.onClick)
      }
      return R.createElement(actual.Button, p)
    },
  }
})

import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {ConversationThreadProvider} from '../thread-context'
import Rekey from './container'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const showPendingRekeyStatus = 'keybase.1.rekey.showPendingRekeyStatus'

let fake: FakeEngine

const renderRekey = () => {
  metasReceived([{...makeConversationMeta(), conversationIDKey, rekeyers: new Set(['testuser'])}], undefined, {
    force: true,
  })
  const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey}, route: 'chatRoot'})
  render(
    <Nav>
      <ConversationThreadProvider id={conversationIDKey}>
        <Rekey />
      </ConversationThreadProvider>
    </Nav>
  )
}

beforeEach(() => {
  mockFirstOnClick.clear()
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

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
test('a screen whose thread has retired asks for no rekey', async () => {
  renderRekey()
  act(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id2',
      deviceName: 'testuser-mac',
      uid: 'uid2',
      username: 'testuser2',
    })
  })
  expect(mockFirstOnClick.has('Rekey')).toBe(true)
  act(() => {
    mockFirstOnClick.get('Rekey')?.()
  })
  await flush()
  expect(paramsOf(fake, showPendingRekeyStatus)).toEqual([])
})
