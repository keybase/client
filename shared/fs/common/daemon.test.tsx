/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {cleanup, render} from '@testing-library/react'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {installNavigation, makeRootState, uninstallNavigation} from '@/test/navigation'
import {resetAllStores} from '@/util/zustand'
import {useRouterState} from '@/stores/router'
import {FsDaemonProvider} from './daemon'

const userIn = 'keybase.1.SimpleFS.simpleFSUserIn'
const userOut = 'keybase.1.SimpleFS.simpleFSUserOut'

afterEach(() => {
  cleanup()
  uninstallNavigation()
  resetAllStores()
  // a reset keeps the nav state, as the navigator outlives an account; each test starts the app afresh
  useRouterState.setState({navState: undefined})
})

// The router store starts with no nav state, so the first state the provider sees has an
// undefined predecessor. That must read as "was on no screen", not as whatever the live
// navigator shows right now - which is already the new state.
test('landing on a files screen from the initial undefined nav state counts as entering files', async () => {
  const fake = installFakeEngine()
  fake.answer(userIn, () => null)
  fake.answer(userOut, () => null)
  render(<FsDaemonProvider>{null}</FsDaemonProvider>)

  installNavigation({rootState: makeRootState({tab: Tabs.fsTab})})
  await flush()

  expect(fake.calls.map(c => c.method)).toEqual([userIn])
})

test('leaving the files screens tells the service the user is out', async () => {
  const fake = installFakeEngine()
  fake.answer(userIn, () => null)
  fake.answer(userOut, () => null)
  render(<FsDaemonProvider>{null}</FsDaemonProvider>)
  const nav = installNavigation({rootState: makeRootState({tab: Tabs.fsTab})})
  await flush()

  nav.setRootState(makeRootState({tab: Tabs.chatTab}))
  await flush()

  expect(fake.calls.map(c => c.method)).toEqual([userIn, userOut])
})
