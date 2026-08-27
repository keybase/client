/// <reference types="jest" />
import * as T from '@/constants/types'

const mockNavigateAppend = jest.fn()
jest.mock('@/constants/router', () => ({
  clearModals: jest.fn(),
  navUpToScreen: jest.fn(),
  navigateAppend: (...args: Array<unknown>) => mockNavigateAppend(...args),
  navigateUp: jest.fn(),
}))

import {RPCError} from '@/util/errors'
import {handleContactSettingsBlock, handleNotAdded} from './actions'

const contactSettingsError = (fields: unknown) =>
  new RPCError('blocked', T.RPCGen.StatusCode.scteamcontactsettingsblock, fields)

describe('handleContactSettingsBlock', () => {
  beforeEach(() => {
    mockNavigateAppend.mockClear()
  })

  test('ignores other error codes', () => {
    expect(handleContactSettingsBlock(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))).toBe(false)
    expect(mockNavigateAppend).not.toHaveBeenCalled()
  })

  test('navigates with the blocked usernames', () => {
    expect(
      handleContactSettingsBlock(contactSettingsError([{key: 'usernames', value: 'testuser,testuser-mac'}]))
    ).toBe(true)
    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'contactRestricted',
      params: {source: 'teamAddAllFailed', usernames: ['testuser', 'testuser-mac']},
    })
  })

  // '' splits into [''], which used to put a blank row on the contactRestricted screen
  test('has no usernames when the field is empty or missing', () => {
    for (const fields of [[{key: 'usernames', value: ''}], [{key: 'other', value: 'testuser'}], undefined]) {
      mockNavigateAppend.mockClear()
      expect(handleContactSettingsBlock(contactSettingsError(fields))).toBe(true)
      expect(mockNavigateAppend).toHaveBeenCalledWith({
        name: 'contactRestricted',
        params: {source: 'teamAddAllFailed', usernames: []},
      })
    }
  })
})

describe('handleNotAdded', () => {
  beforeEach(() => {
    mockNavigateAppend.mockClear()
  })

  test('navigates only when somebody was skipped', () => {
    handleNotAdded([])
    handleNotAdded(undefined)
    expect(mockNavigateAppend).not.toHaveBeenCalled()
    handleNotAdded([{username: 'testuser'}])
    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'contactRestricted',
      params: {source: 'teamAddSomeFailed', usernames: ['testuser']},
    })
  })
})
