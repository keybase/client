/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
let mockCanSetMinWriterRole = true
jest.mock('../../data-hooks', () => ({
  useConversationMeta: () => mockMeta,
}))
jest.mock('../../team-hooks', () => ({
  useChatTeam: () => ({yourOperations: {setMinWriterRole: mockCanSetMinWriterRole}}),
}))
// the real menu positions itself against a measured anchor and renders nothing in jsdom;
// a flat list of its items is enough to pick a role
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<object>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    FloatingMenu: (p: {items: Array<{title: string; onClick: () => void}>}) =>
      R.createElement(
        'div',
        {'data-testid': 'role-menu'},
        p.items.map(i => R.createElement('button', {key: i.title, onClick: i.onClick}, i.title))
      ),
  }
})

import MinWriterRole from './min-writer-role'

const renderMinWriterRole = (minWriterRole: T.Teams.TeamRoleType = 'reader') => {
  mockMeta = {...makeConversationMeta(), conversationIDKey, minWriterRole, teamname: 'acme'}
  return render(<MinWriterRole conversationIDKey={conversationIDKey} />)
}

// opens the dropdown (showing the current role) and picks a role from the menu
const pickRole = (current: string, next: string) => {
  fireEvent.click(screen.getByText(current, {selector: '.text_BodySemibold'}))
  const menu = screen.getByTestId('role-menu')
  const button = [...menu.querySelectorAll('button')].find(b => b.textContent === next)!
  fireEvent.click(button)
}

const shownRole = (container: HTMLElement) =>
  container.querySelector('.clickable-box2 .text_BodySemibold')?.textContent

const saveIndicator = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('div[style*="height: 17px"]')!

let rpc: FakeChatRpc

beforeEach(() => {
  rpc = installFakeChatRpc()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreChatRpc()
  mockMeta = makeConversationMeta()
  mockCanSetMinWriterRole = true
})

describe('setConvMinWriterRole', () => {
  test('picking a new role sends the conversation and the role', async () => {
    renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    // exactly one call, with no waiting key
    expect(rpc.calls('setMinWriterRole')).toEqual([[conversationIDKey, 'writer']])
  })

  test('each pick sends its own role', async () => {
    renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()
    pickRole('Admin', 'Owner')
    await flush()

    expect(rpc.calls('setMinWriterRole').map(c => c[1])).toEqual(['admin', 'owner'])
  })

  test('picking the role already selected sends nothing', async () => {
    renderMinWriterRole('writer')

    pickRole('Writer', 'Writer')
    await flush()

    expect(rpc.calls('setMinWriterRole')).toEqual([])
  })

  test('a successful save shows the spinner while waiting, then Saved with the new role kept', async () => {
    let resolveSave: (() => void) | undefined
    rpc.on(
      'setMinWriterRole',
      async () =>
        new Promise<void>(resolve => {
          resolveSave = resolve
        })
    )
    const {container} = renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    // optimistic: the dropdown shows the pick before the service answers
    expect(shownRole(container)).toBe('Writer')
    expect(saveIndicator(container).childElementCount).toBeGreaterThan(0)
    expect(saveIndicator(container).textContent).not.toContain('Saved')

    resolveSave?.()
    await flush()

    expect(saveIndicator(container).textContent).toContain('Saved')
    expect(shownRole(container)).toBe('Writer')
    expect(container.textContent).not.toContain('Failed')
  })

  test('a failed save shows the error, reverts the selection to the conversation role and hides the indicator', async () => {
    rpc.fail('setMinWriterRole', new Error('you are not an admin'))
    const {container} = renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()

    expect(screen.getByText('you are not an admin')).toBeTruthy()
    expect(shownRole(container)).toBe('Reader')
    expect(saveIndicator(container).style.display).toBe('none')
  })

  test('a failure without a message falls back to generic error text', async () => {
    rpc.fail('setMinWriterRole', new Error(''))
    renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    expect(screen.getByText('Failed to save minimum posting role.')).toBeTruthy()
  })

  test('the next save clears a previous error banner', async () => {
    rpc.failOnce('setMinWriterRole', new Error('you are not an admin'))
    rpc.once('setMinWriterRole', () => undefined)
    renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()
    expect(screen.queryByText('you are not an admin')).toBeTruthy()

    pickRole('Reader', 'Writer')
    await flush()

    expect(screen.queryByText('you are not an admin')).toBeNull()
  })

  test('a failure of an older save is ignored once a newer save has started', async () => {
    const rejects: Array<(e: Error) => void> = []
    rpc.on(
      'setMinWriterRole',
      async () =>
        new Promise<void>((_resolve, reject) => {
          rejects.push(reject)
        })
    )
    const {container} = renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()
    pickRole('Writer', 'Admin')
    await flush()

    rejects[0]?.(new Error('stale failure'))
    await flush()

    expect(screen.queryByText('stale failure')).toBeNull()
    expect(shownRole(container)).toBe('Admin')
  })

  test('without permission the role is only described and nothing can be sent', () => {
    mockCanSetMinWriterRole = false
    const {container} = renderMinWriterRole('writer')

    expect(container.textContent).toContain('You must be at least a “writer” to post in this channel.')
    expect(container.querySelector('.clickable-box2')).toBeNull()
    expect(rpc.calls('setMinWriterRole')).toEqual([])
  })
})
