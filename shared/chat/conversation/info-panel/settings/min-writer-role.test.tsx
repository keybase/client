/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import {resetAllStores} from '@/util/zustand'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const teamID = 'team-1' as T.Teams.TeamID
const setMinWriterRole = 'chat.1.local.setConvMinWriterRoleLocal'

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

// Your role in acme comes from the role map the app's teams-list provider loads; an admin may set
// the minimum writer role
const renderMinWriterRole = async (
  minWriterRole: T.Teams.TeamRoleType = 'reader',
  yourRole: T.RPCGen.TeamRole = T.RPCGen.TeamRole.admin
) => {
  fake.answer('keybase.1.teams.teamListUnverified', () => ({teams: []}))
  fake.answer('keybase.1.teams.getTeamRoleMap', () => ({
    teams: {[teamID]: {implicitRole: T.RPCGen.TeamRole.none, role: yourRole}},
    version: 1,
  }))
  metasReceived([
    {...makeConversationMeta(), conversationIDKey, minWriterRole, teamID, teamname: 'acme', trustedState: 'trusted'},
  ])
  const r = render(
    <LoadedTeamsListProvider>
      <MinWriterRole conversationIDKey={conversationIDKey} />
    </LoadedTeamsListProvider>
  )
  await flush()
  return r
}

const sentRoles = () =>
  paramsOf(fake, setMinWriterRole).map((p: {role: T.RPCGen.TeamRole}) => T.RPCGen.TeamRole[p.role])

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

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('setConvMinWriterRole', () => {
  test('picking a new role sends the conversation and the role', async () => {
    fake.answer(setMinWriterRole, () => null)
    await renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    // exactly one call, with no waiting key
    expect(paramsOf(fake, setMinWriterRole)).toEqual([
      {convID: T.Chat.keyToConversationID(conversationIDKey), role: T.RPCGen.TeamRole.writer},
    ])
  })

  test('each pick sends its own role', async () => {
    fake.answer(setMinWriterRole, () => null)
    await renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()
    pickRole('Admin', 'Owner')
    await flush()

    expect(sentRoles()).toEqual(['admin', 'owner'])
  })

  test('picking the role already selected sends nothing', async () => {
    await renderMinWriterRole('writer')

    pickRole('Writer', 'Writer')
    await flush()

    expect(paramsOf(fake, setMinWriterRole)).toEqual([])
  })

  test('a successful save shows the spinner while waiting, then Saved with the new role kept', async () => {
    const held = fake.hold(setMinWriterRole)
    const {container} = await renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    // optimistic: the dropdown shows the pick before the service answers
    expect(shownRole(container)).toBe('Writer')
    expect(saveIndicator(container).childElementCount).toBeGreaterThan(0)
    expect(saveIndicator(container).textContent).not.toContain('Saved')

    held[0]!.reply(null)
    await flush()

    expect(saveIndicator(container).textContent).toContain('Saved')
    expect(shownRole(container)).toBe('Writer')
    expect(container.textContent).not.toContain('Failed')
  })

  test('a failed save shows the error, reverts the selection to the conversation role and hides the indicator', async () => {
    fake.answer(setMinWriterRole, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'you are not an admin'))
    const {container} = await renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()

    expect(screen.getByText('you are not an admin')).toBeTruthy()
    expect(shownRole(container)).toBe('Reader')
    expect(saveIndicator(container).style.display).toBe('none')
  })

  test('a failure without a description falls back to generic error text', async () => {
    fake.answer(setMinWriterRole, () => fakeError(T.RPCGen.StatusCode.scgeneric, ''))
    await renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()

    expect(screen.getByText('Failed to save minimum posting role.')).toBeTruthy()
  })

  test('a service failure shows the service\'s reason in the banner', async () => {
    fake.answer(setMinWriterRole, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'you are not an admin'))
    await renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()

    expect(screen.getByText(/you are not an admin/)).toBeTruthy()
  })

  test('the next save clears a previous error banner', async () => {
    fake.answer(setMinWriterRole, (p: {role: T.RPCGen.TeamRole}) =>
      p.role === T.RPCGen.TeamRole.admin ? fakeError(T.RPCGen.StatusCode.scgeneric, 'you are not an admin') : null
    )
    await renderMinWriterRole('reader')

    pickRole('Reader', 'Admin')
    await flush()
    expect(screen.queryByText('you are not an admin')).toBeTruthy()

    pickRole('Reader', 'Writer')
    await flush()

    expect(screen.queryByText('you are not an admin')).toBeNull()
  })

  test('a failure of an older save is ignored once a newer save has started', async () => {
    const held = fake.hold(setMinWriterRole)
    const {container} = await renderMinWriterRole('reader')

    pickRole('Reader', 'Writer')
    await flush()
    pickRole('Writer', 'Admin')
    await flush()

    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'stale failure'))
    await flush()

    expect(screen.queryByText('stale failure')).toBeNull()
    expect(shownRole(container)).toBe('Admin')
  })

  test('without permission the role is only described and nothing can be sent', async () => {
    const {container} = await renderMinWriterRole('writer', T.RPCGen.TeamRole.writer)

    expect(container.textContent).toContain('You must be at least a “writer” to post in this channel.')
    expect(container.querySelector('.clickable-box2')).toBeNull()
    expect(paramsOf(fake, setMinWriterRole)).toEqual([])
  })
})
