/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const hexTeamID = '0a1b2cff' as T.Teams.TeamID

let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
jest.mock('../data-hooks', () => ({
  useConversationMetadata: () => ({
    meta: mockMeta,
    participants: {all: [], contactName: new Map(), name: []},
  }),
}))
jest.mock('../team-hooks', () => ({
  useChatManageChannelsBadge: () => ({dismiss: async () => {}, showBadge: false}),
  useChatTeam: () => ({teamname: 'acme', yourOperations: {manageMembers: false}}),
}))
type MockMenuItem = {title: string; onClick?: () => void; view?: unknown}
// the real menu positions itself against a measured anchor and renders nothing in jsdom;
// a flat list of its titled items is enough to click one
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<object>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    FloatingMenu: (p: {items: ReadonlyArray<MockMenuItem | null | 'Divider'>}) =>
      R.createElement(
        'div',
        {'data-testid': 'menu'},
        p.items.flatMap(i =>
          i && i !== 'Divider' && !i.view
            ? [R.createElement('button', {key: i.title, onClick: i.onClick}, i.title)]
            : []
        )
      ),
  }
})

import InfoPanelMenu from './menu'

let nav: FakeNavigator
let rpc: FakeChatRpc

const bigTeamChannelMeta = (teamID: T.Teams.TeamID): T.Chat.ConversationMeta => ({
  ...makeConversationMeta(),
  channelname: 'random',
  conversationIDKey,
  membershipType: 'active',
  teamID,
  teamType: 'big',
  teamname: 'acme',
})

// the info panel's menu for a big team channel, as opened from the channel header
const renderChannelMenu = (teamID: T.Teams.TeamID) => {
  mockMeta = bigTeamChannelMeta(teamID)
  return render(
    <InfoPanelMenu
      conversationIDKey={conversationIDKey}
      hasHeader={false}
      isSmallTeam={false}
      onHidden={() => {}}
      visible={true}
    />
  )
}

// the team-level menu (no conversation), as opened from the inbox's big team row
const renderTeamMenu = (teamID: T.Teams.TeamID) =>
  render(<InfoPanelMenu hasHeader={false} isSmallTeam={false} onHidden={() => {}} teamID={teamID} visible={true} />)

beforeEach(() => {
  rpc = installFakeChatRpc()
  nav = installFakeNavigator({
    modalRouteNames: ['chatInfoPanel'],
    rootState: makeRootState({above: [{name: 'chatInfoPanel'}]}),
  })
  useConfigState.getState().dispatch.setLoggedIn(true)
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreNavigator()
  restoreChatRpc()
  resetAllStores()
  mockMeta = makeConversationMeta()
})

describe('onMarkAsRead', () => {
  test('marks the whole team TLF read, sending the team id, and closes the modal', async () => {
    renderChannelMenu(hexTeamID)
    expect(nav.modalsCleared()).toBe(false)

    fireEvent.click(screen.getByText('Mark all as read'))
    await flush()

    // exactly one call, with the team id only
    expect(rpc.calls('markTeamRead')).toEqual([[hexTeamID]])
    expect(nav.modalsCleared()).toBe(true)
  })

  test('the team-level menu sends the team id from its teamID prop', async () => {
    renderTeamMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await flush()

    expect(rpc.calls('markTeamRead')).toEqual([[hexTeamID]])
  })

  test('logged out, the modal still closes but nothing is sent', async () => {
    // setLoggedIn(false) resets every store; flip only the flag the menu reads
    useConfigState.setState({loggedIn: false})
    renderChannelMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await flush()

    expect(rpc.calls('markTeamRead')).toEqual([])
    expect(nav.modalsCleared()).toBe(true)
  })

  test.each([
    ['not hex', 'team-1'],
    ['an odd number of digits', '0a1'],
    ['empty', ''],
  ])('a team id that is %s hides the item, so nothing can be sent', (_label, teamID) => {
    renderChannelMenu(teamID)

    expect(screen.queryByText('Mark all as read')).toBeNull()
    expect(screen.getByText('Mark as unread')).toBeTruthy()
    expect(rpc.calls('markTeamRead')).toEqual([])
  })

  test('a small team has no mark-all item', () => {
    mockMeta = {...bigTeamChannelMeta(hexTeamID), teamType: 'small'}
    render(
      <InfoPanelMenu
        conversationIDKey={conversationIDKey}
        hasHeader={false}
        isSmallTeam={true}
        onHidden={() => {}}
        visible={true}
      />
    )

    expect(screen.queryByText('Mark all as read')).toBeNull()
  })

  test('a failure is only logged: the modal is already closed and nothing is shown', async () => {
    const error = new Error('mark read failed')
    rpc.fail('markTeamRead', error)
    const logError = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {container} = renderChannelMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await flush()

    expect(logError).toHaveBeenCalledWith('ignorePromise error', error)
    expect(nav.modalsCleared()).toBe(true)
    expect(container.textContent).not.toContain('mark read failed')
  })
})
