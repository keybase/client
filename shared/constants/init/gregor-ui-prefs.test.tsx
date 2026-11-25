/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, renderHook} from '@testing-library/react'
import {_onEngineIncoming} from '@/constants/init/shared'
import {useBlockButtonsState} from '@/chat/blocking/block-buttons-state'
import {useChosenChannelsTeamnames} from '@/chat/conversation/manage-channels-badge'
import {getExplodingModeFromConfig} from '@/chat/conversation/thread-load'
import {setConversationPinned} from '@/chat/inbox/pinned-convs'
import {useConfigState} from '@/stores/config'
import {useNotifState} from '@/stores/notifications'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'

const convID = T.Chat.stringToConversationIDKey('c1')

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
})

afterEach(() => {
  uninstallFakeEngine()
  resetAllStores()
})

const pushPrefs = async (prefs: T.RPCGen.GregorUIPrefs) =>
  act(async () => {
    await fake.push('keybase.1.gregorUI.pushUIPrefs', {prefs}, {oneway: true})
    await settle()
  })

test('connecting registers for the prefs instead of the raw gregor firehose', async () => {
  fake.answer('keybase.1.delegateUiCtl.registerGregorUIPrefs', () => null)
  fake.answer('keybase.1.config.helloIAm', () => null)
  useConfigState.getState().dispatch.onEngineConnected()
  await settle()
  const methods = fake.calls.map(c => c.method)
  expect(methods).toContain('keybase.1.delegateUiCtl.registerGregorUIPrefs')
  expect(methods.some(m => m.includes('Firehose'))).toBe(false)
})

test('a prefs push from the service reaches every store that reads gregor', async () => {
  const {result} = renderHook(() => useChosenChannelsTeamnames())
  await pushPrefs({
    allowAnimatedEmojis: false,
    blockButtonsAdders: {t1: 'testuser-mac'},
    chosenChannelsTeamnames: ['teamone'],
    explodingModes: {[convID]: 300},
    pinnedConvs: [convID],
    teamAccessRequests: {t1: ['testuser']},
  })

  expect(useConfigState.getState().allowAnimatedEmojis).toBe(false)
  expect(getExplodingModeFromConfig(convID)).toBe(300)
  expect(useBlockButtonsState.getState().blockButtonsMap.get('t1')).toEqual({adder: 'testuser-mac'})
  expect(useNotifState.getState().newTeamRequests.get('t1')).toEqual(new Set(['testuser']))
  expect(result.current).toEqual(new Set(['teamone']))

  // a dismissed category drops out of the next push
  await pushPrefs({allowAnimatedEmojis: true})
  expect(useConfigState.getState().allowAnimatedEmojis).toBe(true)
  expect(getExplodingModeFromConfig(convID)).toBe(0)
  expect(useBlockButtonsState.getState().blockButtonsMap.size).toBe(0)
  expect(useNotifState.getState().newTeamRequests.size).toBe(0)
  expect(result.current).toEqual(new Set())
})

test('pinning reads the current list from the service and writes it back with the new pin on top', async () => {
  fake.answer('keybase.1.gregor.getUIPrefs', () => ({allowAnimatedEmojis: true, pinnedConvs: ['a', 'b']}))
  fake.answer('keybase.1.gregor.updateCategory', () => null)
  fake.answer('chat.1.local.requestInboxLayout', () => null)
  useConfigState.setState({loggedIn: true})
  setConversationPinned(T.Chat.stringToConversationIDKey('b'), true)
  await settle()
  const write = fake.calls.find(c => c.method === 'keybase.1.gregor.updateCategory')
  expect(write?.params).toMatchObject({body: '["b","a"]', category: 'chatPinnedConvs'})
})
