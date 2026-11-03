/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import * as NavTree from '@/constants/nav-tree'
import {installNavigation, makeRootState, type InstalledNavigation} from '@/test/navigation'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const hexTeamID = '0a1b2cff' as T.Teams.TeamID

import {setupOverlayDom} from '@/test/overlay-dom.desktop'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import InfoPanelMenu from './menu'

// the menu draws in #modal-root, as the app's real menu does
setupOverlayDom()

let nav: InstalledNavigation
let fake: FakeEngine

const markTeamRead = 'chat.1.local.markTLFAsReadLocal'

const bigTeamChannelMeta = (teamID: T.Teams.TeamID): T.Chat.ConversationMeta => ({
  ...makeConversationMeta(),
  channelname: 'random',
  conversationIDKey,
  membershipType: 'active',
  teamID,
  teamType: 'big',
  teamname: 'acme',
  trustedState: 'trusted',
})

const setMeta = (meta: T.Chat.ConversationMeta) => {
  metasReceived([meta])
}

// the menu renders inside the app's teams-list provider, which loads your teams and roles
const inTeamsList = (children: React.ReactNode) => <LoadedTeamsListProvider>{children}</LoadedTeamsListProvider>

// the info panel's menu for a big team channel, as opened from the channel header
const renderChannelMenu = (teamID: T.Teams.TeamID) => {
  setMeta(bigTeamChannelMeta(teamID))
  return render(
    inTeamsList(
      <InfoPanelMenu
        conversationIDKey={conversationIDKey}
        hasHeader={false}
        isSmallTeam={false}
        onHidden={() => {}}
        visible={true}
      />
    )
  )
}

// the team-level menu (no conversation), as opened from the inbox's big team row
const renderTeamMenu = (teamID: T.Teams.TeamID, p?: {hasHeader?: boolean; showPinItems?: boolean}) =>
  render(
    inTeamsList(
      <InfoPanelMenu
        hasHeader={p?.hasHeader ?? true}
        isSmallTeam={false}
        onHidden={() => {}}
        showPinItems={p?.showPinItems}
        teamID={teamID}
        visible={true}
      />
    )
  )

beforeEach(() => {
  fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  // a writer in acme, who may not manage its members
  fake.answer('keybase.1.teams.teamListUnverified', () => ({
    teams: [
      {
        fqName: 'acme',
        isMemberShowcased: false,
        isOpenTeam: false,
        memberCount: 2,
        role: T.RPCGen.TeamRole.writer,
        teamID: hexTeamID,
        username: 'testuser',
      },
    ],
  }))
  fake.answer('keybase.1.teams.getTeamRoleMap', () => ({
    teams: {[hexTeamID]: {implicitRole: T.RPCGen.TeamRole.none, role: T.RPCGen.TeamRole.writer}},
    version: 1,
  }))
  // the team-level menu's header loads the team's members
  fake.answer('keybase.1.teams.teamGetMembersByID', () => [])
  // after the account is in place: the desktop tab bar it draws reads it
  nav = installNavigation({rootState: makeRootState({above: [{name: 'chatInfoPanel'}]})})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  nav.unmount()
  resetAllStores()
})

describe('team-level menu', () => {
  test('has no mark-unread item', () => {
    renderTeamMenu(hexTeamID)

    expect(screen.getByText('Mark all as read')).toBeTruthy()
    expect(screen.queryByText('Mark as unread')).toBeNull()
  })

  test('has no pin items even when asked for them', () => {
    renderTeamMenu(hexTeamID, {showPinItems: true})

    expect(screen.queryByText('Pin to top')).toBeNull()
  })

  test('without a header, has no join-channel item', () => {
    renderTeamMenu(hexTeamID, {hasHeader: false})

    expect(screen.queryByText('Join channel')).toBeNull()
  })
})

// the menu for one big team channel, as opened from its inbox row
const renderChannelRowMenu = (meta: Partial<T.Chat.ConversationMeta> = {}) => {
  setMeta({...bigTeamChannelMeta(hexTeamID), ...meta})
  return render(
    inTeamsList(
      <InfoPanelMenu
        channelOnly={true}
        conversationIDKey={conversationIDKey}
        hasHeader={false}
        isSmallTeam={false}
        onHidden={() => {}}
        visible={true}
      />
    )
  )
}

const modals = () => NavTree.modalStack(nav.getRootState()).map(r => r.name)

// the titles of the open menu's items, top to bottom
const itemTitles = () =>
  [...screen.getByTestId(TestIDs.FLOATING_MENU).querySelectorAll('.title')].map(t => t.textContent)

describe('channel row menu', () => {
  test('has only the channel items', () => {
    renderChannelRowMenu()

    expect(screen.getByText('random')).toBeTruthy()
    expect(itemTitles()).toEqual(['Mark as unread', 'Mute', 'Backup conversation'])
  })

  test('a muted channel offers unmute', () => {
    renderChannelRowMenu({isMuted: true})

    expect(itemTitles()).toEqual(['Mark as unread', 'Unmute', 'Backup conversation'])
  })

  test('mute mutes the channel', async () => {
    fake.answer('chat.1.local.SetConversationStatusLocal', () => ({}))
    renderChannelRowMenu()

    fireEvent.click(screen.getByText('Mute'))
    await act(flush)

    expect(paramsOf(fake, 'chat.1.local.SetConversationStatusLocal')).toEqual([
      {
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        status: T.RPCChat.ConversationStatus.muted,
      },
    ])
  })

  test('backup backs up the channel, not the team', () => {
    renderChannelRowMenu()

    fireEvent.click(screen.getByText('Backup conversation'))

    expect(nav.visibleScreen()?.name).toBe('archiveModal')
    expect(nav.visibleScreen()?.params).toEqual({conversationIDKey, type: 'chatID'})
  })
})

describe('onMarkAsRead', () => {
  test('marks the whole team TLF read, sending the team id, and closes the modal', async () => {
    fake.answer(markTeamRead, () => null)
    renderChannelMenu(hexTeamID)
    expect(modals()).toEqual(['chatInfoPanel'])

    fireEvent.click(screen.getByText('Mark all as read'))
    await act(flush)

    // exactly one call, with the team id only
    expect(paramsOf(fake, markTeamRead)).toEqual([{tlfID: new Uint8Array([0x0a, 0x1b, 0x2c, 0xff])}])
    expect(modals()).toEqual([])
  })

  test('the team-level menu sends the team id from its teamID prop', async () => {
    fake.answer(markTeamRead, () => null)
    renderTeamMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await act(flush)

    expect(paramsOf(fake, markTeamRead)).toEqual([{tlfID: new Uint8Array([0x0a, 0x1b, 0x2c, 0xff])}])
  })

  test('logged out, the modal still closes but nothing is sent', async () => {
    // setLoggedIn(false) resets every store; flip only the flag the menu reads
    useConfigState.setState({loggedIn: false})
    renderChannelMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await act(flush)

    expect(paramsOf(fake, markTeamRead)).toEqual([])
    expect(modals()).toEqual([])
  })

  test.each([
    ['not hex', 'team-1'],
    ['an odd number of digits', '0a1'],
    ['empty', ''],
  ])('a team id that is %s hides the item, so nothing can be sent', (_label, teamID) => {
    renderChannelMenu(teamID)

    expect(screen.queryByText('Mark all as read')).toBeNull()
    expect(screen.getByText('Mark as unread')).toBeTruthy()
    expect(paramsOf(fake, markTeamRead)).toEqual([])
  })

  test('a small team has no mark-all item', () => {
    setMeta({...bigTeamChannelMeta(hexTeamID), teamType: 'small'})
    render(
      inTeamsList(
        <InfoPanelMenu
          conversationIDKey={conversationIDKey}
          hasHeader={false}
          isSmallTeam={true}
          onHidden={() => {}}
          visible={true}
        />
      )
    )

    expect(screen.queryByText('Mark all as read')).toBeNull()
  })

  test('a failure is only logged: the modal is already closed and nothing is shown', async () => {
    fake.answer(markTeamRead, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'mark read failed'))
    const logError = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {container} = renderChannelMenu(hexTeamID)

    fireEvent.click(screen.getByText('Mark all as read'))
    await act(flush)

    expect(logError).toHaveBeenCalledWith(
      'ignorePromise error',
      expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric, desc: 'mark read failed'})
    )
    expect(modals()).toEqual([])
    expect(container.textContent).not.toContain('mark read failed')
  })
})
