/// <reference types="jest" />
// The contacts store is a no-op on desktop, so load it as mobile.
import type * as ContactsStore from '../settings-contacts'
import type * as CurrentUser from '../current-user'
import type * as Waiting from '@/stores/waiting'
import type * as Logger from '@/logger'
import type * as TT from '@/constants/types'
import type {FakeNativeKbModule} from '@/test/fake-native-kb'

// The address book and the locale are native; their values are expo-contacts' own.
const mockGetAllDetails = jest.fn()
const mockRequestPermissions = jest.fn()
jest.mock('expo-contacts', () => ({
  Contact: {getAllDetails: (...args: Array<unknown>) => mockGetAllDetails(...args)},
  ContactField: {EMAILS: 'emails', FULL_NAME: 'fullName', PHONES: 'phones'},
  PermissionStatus: {GRANTED: 'granted'},
  getPermissionsAsync: async () => Promise.resolve({status: 'granted'}),
  requestPermissionsAsync: async (...args: Array<unknown>) => Promise.resolve(mockRequestPermissions(...args)),
}))
jest.mock('expo-localization', () => ({getLocales: () => [{regionCode: 'US'}]}))
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

const g = globalThis as {isMobile?: boolean}
let store: typeof ContactsStore
let currentUser: typeof CurrentUser
let waiting: typeof Waiting
let logger: typeof Logger
let T: typeof TT

beforeEach(() => {
  g.isMobile = true
  jest.isolateModules(() => {
    store = require('../settings-contacts')
    currentUser = require('../current-user')
    // The waiting store keeps Maps; the isolated registry has its own immer
    ;(require('immer') as {enableMapSet: () => void}).enableMapSet()
    waiting = require('@/stores/waiting')
    logger = require('@/logger')
    T = require('@/constants/types')
  })
  currentUser.useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid: 'uid-1', username: 'testuser'})
  store.useSettingsContactsState.setState({importEnabled: true, permissionStatus: 'granted'})
})

afterEach(() => {
  g.isMobile = false
  jest.restoreAllMocks()
})

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

test('uploads the address book for the account that enabled import', async () => {
  mockGetAllDetails.mockResolvedValue([{fullName: 'a', phoneNumbers: [{number: '+15555550100'}]}])
  const save = jest
    .spyOn(T.RPCGen, 'contactsSaveContactListRpcPromise')
    .mockResolvedValue({newlyResolved: [], resolved: []} as never)

  store.useSettingsContactsState.getState().dispatch.manageContactsCache()
  await flush()

  expect(store.useSettingsContactsState.getState().importError).toBe('')
  expect(save).toHaveBeenCalledTimes(1)
})

test('does not upload to the next account when a switch lands while the address book is read', async () => {
  let finishReading: (c: unknown) => void = () => {}
  mockGetAllDetails.mockImplementation(async () => new Promise(resolve => (finishReading = resolve)))
  const save = jest.spyOn(T.RPCGen, 'contactsSaveContactListRpcPromise')

  store.useSettingsContactsState.getState().dispatch.manageContactsCache()
  await flush()
  currentUser.useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'd2', deviceName: 'dn2', uid: 'uid-2', username: 'testuser-mac'})
  finishReading([{fullName: 'a', phoneNumbers: [{number: '+15555550100'}]}])
  await flush()

  expect(save).not.toHaveBeenCalled()
})

test('asking for permission holds the import key until it is answered, even when asking fails', async () => {
  const importKey = 'settings:importContacts'
  let answer: (r: {status: string}) => void = () => {}
  mockRequestPermissions.mockImplementation(async () => new Promise(resolve => (answer = resolve)))
  store.useSettingsContactsState.getState().dispatch.requestPermissions()
  await flush()
  expect(waiting.useWaitingState.getState().counts.get(importKey)).toBe(1)
  answer({status: 'denied'})
  await flush()
  expect(waiting.useWaitingState.getState().counts.get(importKey)).toBeUndefined()

  const logged = jest.spyOn(logger.default, 'error').mockImplementation(() => {})
  mockRequestPermissions.mockRejectedValue(new Error('no permission api'))
  store.useSettingsContactsState.getState().dispatch.requestPermissions()
  await flush()
  expect(logged).toHaveBeenCalled()
  expect(waiting.useWaitingState.getState().counts.get(importKey)).toBeUndefined()
})
