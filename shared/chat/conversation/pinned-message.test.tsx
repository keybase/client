/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// the handlers the banner first rendered with, which a screen kept through an account switch still
// holds: the close icon's onClick as 'close', the confirm's as 'Yes, unpin'
const mockFirstHandler = new Map<string, () => void>()
const mockKeepFirst = (name: string, f: () => void) => {
  if (!mockFirstHandler.has(name)) {
    mockFirstHandler.set(name, f)
  }
}
// the popup is a positioned overlay; render its header and items inline so the confirm is clickable
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{Icon: React.ComponentType<{onClick?: () => void; type: string}>}>(
    '@/common-adapters'
  )
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    FloatingMenu: (p: {
      header?: React.ReactNode
      items: ReadonlyArray<'Divider' | {onClick: () => void; title: string}>
      visible: boolean
    }) => {
      for (const i of p.items) {
        if (i !== 'Divider') {
          mockKeepFirst(i.title, i.onClick)
        }
      }
      return p.visible
        ? R.createElement(
            'div',
            {'data-testid': 'unpin-popup'},
            p.header,
            ...p.items.map(i =>
              i === 'Divider' ? null : R.createElement('button', {key: i.title, onClick: i.onClick}, i.title)
            )
          )
        : null
    },
    Icon: (p: {onClick?: () => void; type: string}) => {
      if (p.type === 'iconfont-close' && p.onClick) {
        mockKeepFirst('close', p.onClick)
      }
      return R.createElement(actual.Icon, p)
    },
    Markdown: ({children}: {children?: React.ReactNode}) => R.createElement('span', null, children),
  }
})

import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, renderHook, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {makeConversationMeta} from '@/constants/chat/meta'
import {makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import HiddenString from '@/util/hidden-string'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {ConversationThreadProvider} from './thread-context'
import PinnedMessage, {usePinnedMessageShown} from './pinned-message'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const teamID = 'aabbccdd'
const unpin = 'chat.1.local.unpinMessage'
const ignorePin = 'chat.1.local.ignorePinnedMessage'
const getTeamRoleMap = 'keybase.1.teams.getTeamRoleMap'

let fake: FakeEngine

const expectUnpinSent = () => {
  expect(paramsOf(fake, unpin)).toEqual([{convID}])
}
const expectIgnoreSent = () => {
  expect(paramsOf(fake, ignorePin)).toEqual([{convID}])
}

const setPinned = (pinnerUsername: string) => {
  metasReceived(
    [
      {
        ...makeConversationMeta(),
        conversationIDKey,
        pinnedMsg: {
          message: makeMessageText({
            author: 'testuser-mac',
            conversationIDKey,
            decoratedText: new HiddenString('pinned words'),
            id: T.Chat.numberToMessageID(42),
          }),
          pinnerUsername,
        },
        teamID,
        teamname: 'testteam',
        teamType: 'small',
      },
    ],
    undefined,
    {force: true}
  )
}

// what the service's role map says you are in the team
const roleInTeam = (role: T.RPCGen.TeamRole) => {
  fake.answer(getTeamRoleMap, () => ({
    teams: {[teamID]: {implicitRole: T.RPCGen.TeamRole.none, role}},
    version: 1,
  }))
}

const renderBanner = async (params: object = {}) => {
  const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey, ...params}, route: 'chatRoot'})
  const rendered = render(
    <Nav>
      <LoadedTeamsListProvider>
        <ConversationThreadProvider id={conversationIDKey}>
          <PinnedMessage />
        </ConversationThreadProvider>
      </LoadedTeamsListProvider>
    </Nav>
  )
  // the teams list and role map the provider loads
  await flush()
  return rendered
}

const clickClose = (container: HTMLElement) => {
  const icon = container.querySelector('.icon-gen-iconfont-close')
  if (!icon) throw new Error('no close icon')
  fireEvent.click(icon)
}

beforeEach(() => {
  mockFirstHandler.clear()
  fake = installFakeEngine()
  fake.answer('keybase.1.teams.teamListUnverified', () => ({teams: []}))
  roleInTeam(T.RPCGen.TeamRole.writer)
  fake.answer(unpin, () => {})
  fake.answer(ignorePin, () => {})
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  setPinned('testuser-mac')
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const switchAccount = () => {
  act(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id2',
      deviceName: 'testuser-mac',
      uid: 'uid2',
      username: 'testuser2',
    })
  })
}

test('someone else pinned it and you cannot admin-delete: close ignores the pin locally, no popup', async () => {
  const {container, queryByTestId} = await renderBanner()
  expect(container.textContent).toContain('pinned words')

  clickClose(container)
  await flush()

  expect(queryByTestId('unpin-popup')).toBeNull()
  expectIgnoreSent()
  expect(paramsOf(fake, unpin)).toEqual([])
})

test('you pinned it: close opens the confirm popup, and confirming unpins for everyone', async () => {
  setPinned('testuser')
  const {container, getByTestId, getByText, queryByTestId} = await renderBanner()

  clickClose(container)
  expect(getByTestId('unpin-popup').textContent).toContain('Unpin this message?')
  expect(paramsOf(fake, unpin)).toEqual([])

  fireEvent.click(getByText('Yes, unpin'))
  await flush()

  expectUnpinSent()
  expect(paramsOf(fake, ignorePin)).toEqual([])
  expect(queryByTestId('unpin-popup')).toBeNull()
})

test('an admin who can delete others messages also unpins through the popup', async () => {
  roleInTeam(T.RPCGen.TeamRole.admin)
  const {container, getByText} = await renderBanner()

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await flush()

  expectUnpinSent()
  expect(paramsOf(fake, ignorePin)).toEqual([])
})

// the role map is the service's answer: until it lands an admin is a plain reader here
test('an admin whose role map has not loaded yet only ignores the pin', async () => {
  fake.hold(getTeamRoleMap)
  const {container, queryByTestId} = await renderBanner()

  clickClose(container)
  await flush()

  expect(queryByTestId('unpin-popup')).toBeNull()
  expectIgnoreSent()
})

test('a service error from unpin is logged via logger.error and not rethrown', async () => {
  setPinned('testuser')
  fake.answer(unpin, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'cannot unpin'))
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container, getByText} = await renderBanner()

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await flush()

  expect(error).toHaveBeenCalledTimes(1)
  expect(error.mock.calls[0]?.[0]).toMatch(/^pinMessage: .*cannot unpin/)
  // the pin stays on screen; nothing else surfaces the failure
  expect(container.textContent).toContain('pinned words')
})

// what reaches the catch from the real adapter is always an RPCError; a lost link is one too
test('an unpin lost with the service link is logged like any service error', async () => {
  setPinned('testuser')
  fake.hold(unpin)
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container, getByText} = await renderBanner()

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await flush()
  act(() => {
    fake.drop()
  })
  await flush()

  expect(error).toHaveBeenCalledTimes(1)
  expect(error.mock.calls[0]?.[0]).toMatch(/^pinMessage: /)
})

test('a failed ignore falls through to ignorePromise, which logs it', async () => {
  fake.answer(ignorePin, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'ignore failed'))
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container} = await renderBanner()

  clickClose(container)
  await flush()

  expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({desc: 'ignore failed'}))
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
test('a banner whose thread has retired ignores nothing', async () => {
  await renderBanner()
  switchAccount()

  act(() => {
    mockFirstHandler.get('close')?.()
  })
  await flush()

  expect(mockFirstHandler.has('close')).toBe(true)
  expect(paramsOf(fake, ignorePin)).toEqual([])
})

test('a banner whose thread retires while its unpin confirm is open unpins nothing', async () => {
  setPinned('testuser')
  const {container} = await renderBanner()

  clickClose(container)
  switchAccount()
  act(() => {
    mockFirstHandler.get('Yes, unpin')?.()
  })
  await flush()

  expect(mockFirstHandler.has('Yes, unpin')).toBe(true)
  expect(paramsOf(fake, unpin)).toEqual([])
})

// the waiting key rides the real unpin call through the engine, which throttles a key coming on
// (500ms) and lets one going off through at once
test('while the unpin is in flight a spinner replaces the close icon, and the icon is back once it lands', async () => {
  setPinned('testuser')
  const held = fake.hold(unpin)
  const {container, getByText} = await renderBanner()

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await waitFor(() => expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull())
  expect(C.Waiting.useWaitingState.getState().counts.get(C.waitingKeyChatUnpin(conversationIDKey))).toBe(1)

  held[0]!.reply(null)
  await flush()
  expect(container.querySelector('.icon-gen-iconfont-close')).not.toBeNull()
})

test('the pinned banner renders the pinned message', async () => {
  const {queryByText} = await renderBanner()
  expect(queryByText('Pinned')).not.toBeNull()
})

const renderShown = (params: object = {}) => {
  const {wrapper} = navigationWrapper({params: {conversationIDKey, ...params}, route: 'chatRoot'})
  return renderHook(() => usePinnedMessageShown(), {wrapper}).result.current
}

// both layouts mount the banner only when this says so
test('the pinned banner is shown while thread search is closed', () => {
  expect(renderShown()).toBe(true)
})

test('the pinned banner is not shown while thread search is open', () => {
  expect(renderShown({threadSearch: {}})).toBe(false)
})
