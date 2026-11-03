/// <reference types="jest" />
import * as T from '@/constants/types'

import {RPCError} from '@/util/errors'
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {exitTeamTo, handleContactSettingsBlock, handleNotAdded} from './actions'

let nav: FakeNavigator

beforeEach(() => {
  nav = installFakeNavigator()
})

afterEach(() => {
  restoreNavigator()
})

const contactSettingsError = (fields: unknown) =>
  new RPCError('blocked', T.RPCGen.StatusCode.scteamcontactsettingsblock, fields)

describe('handleContactSettingsBlock', () => {
  test('ignores other error codes', () => {
    expect(handleContactSettingsBlock(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))).toBe(false)
    expect(nav.actions).toEqual([])
  })

  test('navigates with the blocked usernames', () => {
    expect(
      handleContactSettingsBlock(contactSettingsError([{key: 'usernames', value: 'testuser,testuser-mac'}]))
    ).toBe(true)
    expect(nav.pushes()).toEqual([
      {
        name: 'contactRestricted',
        params: {source: 'teamAddAllFailed', usernames: ['testuser', 'testuser-mac']},
      },
    ])
  })

  // '' splits into [''], which used to put a blank row on the contactRestricted screen
  test('has no usernames when the field is empty or missing', () => {
    for (const fields of [[{key: 'usernames', value: ''}], [{key: 'other', value: 'testuser'}], undefined]) {
      nav.clearActions()
      expect(handleContactSettingsBlock(contactSettingsError(fields))).toBe(true)
      expect(nav.pushes()).toEqual([
        {name: 'contactRestricted', params: {source: 'teamAddAllFailed', usernames: []}},
      ])
    }
  })
})

describe('handleNotAdded', () => {
  test('navigates only when somebody was skipped', () => {
    handleNotAdded([])
    handleNotAdded(undefined)
    expect(nav.actions).toEqual([])
    handleNotAdded([{username: 'testuser'}])
    expect(nav.pushes()).toEqual([
      {name: 'contactRestricted', params: {source: 'teamAddSomeFailed', usernames: ['testuser']}},
    ])
  })
})

// The confirm's dismissal is not in the tree until React Navigation commits it; with the modal
// still there, a pop to the tab root would target the modal's own stack and be lost.
describe('exitTeamTo', () => {
  beforeEach(() => {
    nav = installFakeNavigator({
      commit: 'manual',
      modalRouteNames: ['teamDeleteTeam'],
      rootState: makeRootState({
        above: [{name: 'teamDeleteTeam', params: {teamID: 'T1'}}],
        tab: Tabs.teamsTab,
        tabStack: [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}],
      }),
    })
  })

  test('pops the tab back to its root once the modal reset commits', () => {
    exitTeamTo('teams')
    expect(nav.types()).not.toContain('POP_TO')

    nav.commit()
    nav.commit()

    expect(nav.lastAction()).toMatchObject({
      payload: {name: 'teamsRoot'},
      target: `${Tabs.teamsTab}-stack`,
      type: 'POP_TO',
    })
    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(NavTree.activeStack(nav.getRootState())?.routes?.map(r => r.name)).toEqual(['teamsRoot'])
  })
})
