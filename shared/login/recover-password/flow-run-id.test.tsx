/// <reference types="jest" />
// Its own file: each run id here is the first of its module instance
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {getCallPort} from '@/engine/call-port'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator} from '@/test/fake-navigator'
import {useRouterState} from '@/stores/router'
import type * as NavTree from '@/constants/nav-tree'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

import {startRecoverPassword} from './flow'
import type * as Flow from './flow'
import type * as CallPort from '@/engine/call-port'
import type * as FakeNavigator from '@/test/fake-navigator'

const recover = 'keybase.1.login.recoverPassphrase'
const chooseDevice = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
const devices = [{deviceID: 'device-1', deviceNumberOfType: 1, name: 'phone', type: 'mobile'}]

const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}

afterEach(() => {
  restoreNavigator()
  resetAllStores()
})

// A second instance of the flow and everything it uses, as a reload makes. Its engine calls go through
// this instance's fake.
let isolated: {callPort: typeof CallPort; flow: typeof Flow; navigator: typeof FakeNavigator} | undefined
jest.isolateModules(() => {
  isolated = {
    callPort: require('@/engine/call-port'),
    flow: require('./flow'),
    navigator: require('@/test/fake-navigator'),
  }
})

// A run of a module instance from before a reload (a JS reload, a hot update of the flow), which left
// its device selector up: the root state it leaves behind
const leftoverFromAnotherInstance = async () => {
  const {callPort, flow, navigator} = isolated!
  const nav = navigator.installFakeNavigator({rootState: navigator.makeRootState({loggedIn: false})})
  const fake = installFakeEngine()
  callPort.installCallPort(getCallPort())
  const held = fake.hold(recover)
  flow.startRecoverPassword({username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  void fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})
  await settle()
  const state = nav.getRootState()
  held[0]!.reply(undefined)
  await settle()
  navigator.restoreNavigator()
  callPort.uninstallCallPort()
  uninstallFakeEngine()
  return state
}

const screens = (state: NavTree.NavState | undefined) =>
  (state?.routes ?? []).flatMap(r => (r.name === 'loggedOut' ? (r.state?.routes ?? []).map(s => s.name) : [r.name]))

test("a screen left by a run of an earlier module instance is not this instance's run's", async () => {
  const leftover = await leftoverFromAnotherInstance()
  expect(screens(leftover)).toEqual(['login', 'recoverPasswordDeviceSelector'])
  const nav = installFakeNavigator({rootState: leftover ?? makeRootState({loggedIn: false})})
  const fake = installFakeEngine()
  const held = fake.hold(recover)
  startRecoverPassword({username: 'testuser'})
  await tick()

  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
  await settle()

  expect(screens(nav.getRootState())).toEqual(['login', 'recoverPasswordDeviceSelector', 'recoverPasswordError'])
  // Dismissed, the error has nothing left to watch for
  nav.addListener('state', () => useRouterState.getState().dispatch.setNavState(nav.getRootState()!))
  nav.navigateUp()
})
