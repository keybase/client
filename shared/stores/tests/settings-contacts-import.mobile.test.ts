/// <reference types="jest" />
// The contacts store is a no-op on desktop, so load it as mobile.
import type * as ContactsStore from '../settings-contacts'
import type * as Config from '../config'
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
const {fakeError, installFakeEngine} = require('@/test/fake-engine') as typeof FakeEngineModule
const {tick} = require('@/test/flush') as typeof Flush

afterAll(() => {
  g.isMobile = false
})

const getRpc = 'keybase.1.contacts.getImportContactsEnabled'
const setRpc = 'keybase.1.contacts.setImportContactsEnabled'
const saveRpc = 'keybase.1.contacts.saveContactList'

const settle = async () => {
  for (let i = 0; i < 10; i++) await tick()
}

beforeEach(() => {
  store.useSettingsContactsState.getState().dispatch.resetState()
  config.useConfigState.setState({loggedIn: true})
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
  expect(store.useSettingsContactsState.getState().importEnabled).toBe(true)
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
