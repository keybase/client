/// <reference types="jest" />
import * as T from '@/constants/types'

import {RPCError} from '@/util/errors'
import {installFakeNavigator, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {handleContactSettingsBlock, handleNotAdded} from './actions'

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
