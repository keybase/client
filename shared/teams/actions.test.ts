/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'

import {RPCError} from '@/util/errors'
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {installNavigation, makeRootState, type MountedNavigation} from '@/test/navigation'
import {exitTeamTo, handleContactSettingsBlock, handleNotAdded} from './actions'

let nav: MountedNavigation

const contactSettingsError = (fields: unknown) =>
  new RPCError('blocked', T.RPCGen.StatusCode.scteamcontactsettingsblock, fields)

describe('handleContactSettingsBlock', () => {
  beforeEach(() => {
    nav = installNavigation()
  })

  test('ignores other error codes', () => {
    expect(handleContactSettingsBlock(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))).toBe(false)
    expect(nav.actions).toEqual([])
  })

  test('navigates with the blocked usernames', () => {
    expect(
      handleContactSettingsBlock(contactSettingsError([{key: 'usernames', value: 'testuser,testuser-mac'}]))
    ).toBe(true)
    expect(nav.visibleScreen()).toMatchObject({
      name: 'contactRestricted',
      params: {source: 'teamAddAllFailed', usernames: ['testuser', 'testuser-mac']},
    })
  })

  // '' splits into [''], which used to put a blank row on the contactRestricted screen
  test('has no usernames when the field is empty or missing', () => {
    for (const fields of [[{key: 'usernames', value: ''}], [{key: 'other', value: 'testuser'}], undefined]) {
      nav = installNavigation()
      expect(handleContactSettingsBlock(contactSettingsError(fields))).toBe(true)
      expect(nav.pushes()).toEqual([
        {name: 'contactRestricted', params: {source: 'teamAddAllFailed', usernames: []}},
      ])
    }
  })
})

describe('handleNotAdded', () => {
  test('navigates only when somebody was skipped', () => {
    nav = installNavigation()
    handleNotAdded([])
    handleNotAdded(undefined)
    expect(nav.actions).toEqual([])
    handleNotAdded([{username: 'testuser'}])
    expect(nav.visibleScreen()).toMatchObject({
      name: 'contactRestricted',
      params: {source: 'teamAddSomeFailed', usernames: ['testuser']},
    })
  })
})

// Out of a team just left or deleted, from its confirm: the confirm closes and the tab the exit
// started from is back on its root, with nothing of the team left above it.
describe('exitTeamTo', () => {
  const confirm = {name: 'teamDeleteTeam', params: {teamID: 'T1'}}
  const team = {name: 'team', params: {teamID: 'T1'}}
  const landed = () => ({
    modals: NavTree.modalStack(nav.getRootState()).map(r => r.name),
    path: NavTree.visiblePath(nav.getRootState()).map(r => r.name),
  })

  test('from the teams tab, lands on teamsRoot with no modal up', () => {
    nav = installNavigation({
      rootState: makeRootState({above: [confirm], tab: Tabs.teamsTab, tabStack: [{name: 'teamsRoot'}, team]}),
    })

    exitTeamTo('teams')

    expect(landed()).toEqual({modals: [], path: ['loggedIn', Tabs.teamsTab, 'teamsRoot']})
  })

  test('from chat, lands on chatRoot with no modal up', () => {
    nav = installNavigation({
      rootState: makeRootState({
        above: [{name: 'chatInfoPanel', params: {conversationIDKey: 'C'}}, confirm],
        tab: Tabs.chatTab,
        tabStack: [{name: 'chatRoot'}, team],
      }),
    })

    exitTeamTo('chat')

    expect(landed()).toEqual({modals: [], path: ['loggedIn', Tabs.chatTab, 'chatRoot']})
  })

  // A phone keeps the team page above the tab bar, in the root stack under the confirm.
  test('on a phone, closes the team page above the tabs too', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({above: [team, {name: 'teamChannel'}, confirm], tab: Tabs.teamsTab}),
    })

    exitTeamTo('teams')

    expect(landed()).toEqual({modals: [], path: ['loggedIn', Tabs.teamsTab, 'teamsRoot']})
  })

  test('on a phone, from chat, lands on chatRoot', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({above: [{name: 'chatConversation'}, team, confirm], tab: Tabs.chatTab}),
    })

    exitTeamTo('chat')

    expect(landed()).toEqual({modals: [], path: ['loggedIn', Tabs.chatTab, 'chatRoot']})
  })
})
