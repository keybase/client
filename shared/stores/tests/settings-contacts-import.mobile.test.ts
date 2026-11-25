/// <reference types="jest" />
// The contacts store is a no-op on desktop, so load it as mobile.
import type * as ContactsStore from '../settings-contacts'
import type * as Config from '../config'
import type * as CurrentUser from '../current-user'
import type * as FakeEngineModule from '@/test/fake-engine'
import type * as Flush from '@/test/flush'
import type {FakeNativeKbModule} from '@/test/fake-native-kb'

jest.mock('expo-contacts', () => ({
  Contact: {getAllDetails: async () => Promise.resolve([])},
  ContactField: {EMAILS: 'emails', FULL_NAME: 'fullName', PHONES: 'phones'},
  PermissionStatus: {GRANTED: 'granted'},
  getPermissionsAsync: async () => Promise.resolve({status: 'denied'}),
  requestPermissionsAsync: async () => Promise.resolve({status: 'denied'}),
}))
jest.mock('expo-localization', () => ({getLocales: () => [{regionCode: 'US'}]}))
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

const g = globalThis as {isMobile?: boolean}
g.isMobile = true
const store = require('../settings-contacts') as typeof ContactsStore
const config = require('../config') as typeof Config
const currentUser = require('../current-user') as typeof CurrentUser
const {fakeError, installFakeEngine} = require('@/test/fake-engine') as typeof FakeEngineModule
const {tick} = require('@/test/flush') as typeof Flush

afterAll(() => {
  g.isMobile = false
})

const getRpc = 'keybase.1.contacts.getImportContactsEnabled'
const setRpc = 'keybase.1.contacts.setImportContactsEnabled'
const saveRpc = 'keybase.1.contacts.saveContactList'

const setUser = (username: string) =>
  currentUser.useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'd1', deviceName: 'testuser-mac', uid: username, username})

const settle = async () => {
  for (let i = 0; i < 10; i++) await tick()
}

beforeEach(() => {
  store.useSettingsContactsState.getState().dispatch.resetState()
  config.useConfigState.setState({loggedIn: true})
  setUser('testuser')
})

test('loads the setting from the service', async () => {
  const fake = installFakeEngine()
  fake.answer(getRpc, () => true)

  store.useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
  await settle()

  expect(store.useSettingsContactsState.getState().importEnabled).toBe(true)
})

test('saving the setting writes it and reads it back', async () => {
  const fake = installFakeEngine()
  let stored = false
  fake.answer(setRpc, ({enabled}: {enabled: boolean}) => {
    stored = enabled
    return null
  })
  fake.answer(getRpc, () => stored)

  store.useSettingsContactsState.getState().dispatch.editContactImportEnabled(true)
  await settle()

  expect(fake.calls.map(c => c.method)).toEqual([setRpc, getRpc])
  expect(fake.calls.map(c => (c.params as {username: string}).username)).toEqual(['testuser', 'testuser'])
  expect(store.useSettingsContactsState.getState().importEnabled).toBe(true)
})

test('a save names the account it was made in, even if handled after a switch', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(setRpc)

  store.useSettingsContactsState.getState().dispatch.editContactImportEnabled(true)
  setUser('testuser2')
  await settle()

  expect(held[0]?.params).toEqual(expect.objectContaining({enabled: true, username: 'testuser'}))
})

test('a setting read for the previous account is dropped', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(getRpc)

  store.useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
  await settle()
  expect(held[0]?.params).toEqual(expect.objectContaining({username: 'testuser'}))
  setUser('testuser2')
  held[0]?.reply(true)
  await settle()

  expect(store.useSettingsContactsState.getState().importEnabled).toBeUndefined()
})

test('a failed read leaves the setting unknown and does not clear the uploaded contacts', async () => {
  const fake = installFakeEngine()
  fake.answer(getRpc, () => fakeError(1, 'login required'))
  fake.answer(saveRpc, () => ({newlyResolved: [], resolved: []}))

  store.useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
  await settle()

  expect(store.useSettingsContactsState.getState().importEnabled).toBeUndefined()
  expect(fake.calls.map(c => c.method)).toEqual([getRpc])
})
