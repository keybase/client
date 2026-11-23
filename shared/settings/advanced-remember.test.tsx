/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import * as Settings from '@/constants/settings'
import '@/test/viewport.desktop'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {refreshRpc} from '@/query'
import {resetAllStores} from '@/util/zustand'
import Advanced from './advanced'

const getRpc = 'keybase.1.config.getRememberPassphrase'
const setRpc = 'keybase.1.config.setRememberPassphrase'

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('a save that fails after dropping a reload asks the service again', async () => {
  const fake = installFakeEngine()
  const gets = fake.hold(getRpc)
  const sets = fake.hold(setRpc)
  // the rest of the screen
  fake.answer('keybase.1.config.getProxyData', () => ({addressWithPort: '', certPinning: false, proxyType: 0}))
  fake.answer('keybase.1.user.loadPassphraseState', () => T.RPCGen.PassphraseState.known)
  fake.answer('keybase.1.config.guiGetValue', () => ({b: false, isNull: false}))
  render(<Advanced />, {wrapper: navigationWrapper({route: Settings.settingsAdvancedTab}).wrapper})
  await flush()
  gets[0]!.reply(false)
  await flush()

  // a reload is on the wire when the box is ticked; the optimistic write drops it
  act(() => refreshRpc(T.RPCGen.configGetRememberPassphraseRpcPromise))
  await flush()
  expect(gets).toHaveLength(2)
  act(() => {
    fireEvent.click(screen.getByTestId(TestIDs.SETTINGS_REMEMBER_PASSWORD_SWITCH))
  })
  await flush()
  expect(sets).toHaveLength(1)
  gets[1]!.reply(true)
  sets[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
  await flush()

  // the dropped reload's answer is lost, so the service is asked again
  expect(gets).toHaveLength(3)
})
