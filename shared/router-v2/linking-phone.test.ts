/// <reference types="jest" />
// Phone shapes. isSplit is computed at module load and this suite loads as desktop, so
// global.isMobile alone yields the tablet shapes (see linking.test.ts / linking-state.test.ts);
// only mocking the module gets the phone ones. On a phone each tab stack holds just its root
// screen -- every other route is registered on the root stack, above the tabs -- so a nested
// route is silently dropped on rehydrate and the tap lands on the tab root.
jest.mock('@/constants/chat/layout', () => ({isSplit: false, threadRouteName: 'chatConversation'}))
import * as Settings from '@/constants/settings'
import * as Tabs from '@/constants/tabs'
import {createLinkingConfig} from './linking'

const getStateFromPath = (path: string) =>
  (createLinkingConfig(jest.fn()).getStateFromPath as (p: string) => unknown)(path)

const wasMobile = global.isMobile
beforeAll(() => {
  global.isMobile = true
})
afterAll(() => {
  global.isMobile = wasMobile
})

test('a devices link opens devices on the root stack above the tabs on a phone', () => {
  expect(getStateFromPath('devices')).toEqual({
    index: 1,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [{name: Tabs.settingsTab, state: {index: 0, routes: [{name: 'settingsRoot'}]}}],
        },
      },
      {name: Settings.settingsDevicesTab},
    ],
  })
})

// A control: if the isSplit mock ever stopped taking effect, this would produce the split
// (chatRoot-with-params) shape instead, and the devices expectation above would be testing
// the tablet path while claiming to test the phone one.
test('the phone shapes are in force -- a conversation opens above the tabs, not in the chat tab', () => {
  expect(getStateFromPath('convid/conv-1')).toEqual({
    index: 1,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [{name: Tabs.chatTab, state: {index: 0, routes: [{name: 'chatRoot', params: {}}]}}],
        },
      },
      {name: 'chatConversation', params: {conversationIDKey: 'conv-1'}},
    ],
  })
})
