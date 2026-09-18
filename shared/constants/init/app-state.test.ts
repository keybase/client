/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import {applyClientState, applyMobileAppState, _onEngineIncoming} from './shared'

const g = globalThis as unknown as {isMobile: boolean}

// The applied versions live outside the store and survive resetAllStores on purpose, so each test
// gets its own epoch rather than a counter that has to beat every earlier test's.
let testEpoch = 500
const version = (counter: number, epoch = testEpoch): T.RPCGen.StateVersion => ({counter, epoch})

beforeEach(() => {
  testEpoch++
  g.isMobile = true
  resetAllStores()
  // the shell store keeps its state across an account-level reset on purpose
  useShellState.setState({mobileAppState: 'unknown'})
})

afterEach(() => {
  g.isMobile = false
})

describe('the app state the service derives', () => {
  test.each([
    [T.RPCGen.MobileAppState.foreground, 'active'],
    [T.RPCGen.MobileAppState.inactive, 'inactive'],
    [T.RPCGen.MobileAppState.background, 'background'],
    // nothing in the UI distinguishes "backgrounded with work still running" from "backgrounded"
    [T.RPCGen.MobileAppState.backgroundactive, 'background'],
  ])('%s becomes %s', (state, expected) => {
    applyMobileAppState(state, version(1))
    expect(useShellState.getState().mobileAppState).toBe(expected)
  })

  test('arrives through the notification', () => {
    _onEngineIncoming({
      payload: {params: {state: T.RPCGen.MobileAppState.background, version: version(1)}},
      type: 'keybase.1.NotifyApp.mobileAppStateChanged',
    } as never)
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('an older notification than the one applied is dropped', () => {
    applyMobileAppState(T.RPCGen.MobileAppState.background, version(5))
    // the fan-out is one goroutine per connection, so this can land after the one above
    applyMobileAppState(T.RPCGen.MobileAppState.foreground, version(4))
    expect(useShellState.getState().mobileAppState).toBe('background')

    applyMobileAppState(T.RPCGen.MobileAppState.foreground, version(6))
    expect(useShellState.getState().mobileAppState).toBe('active')
  })

  test('a new service process wins whatever its counter says', () => {
    applyMobileAppState(T.RPCGen.MobileAppState.background, version(9))
    applyMobileAppState(T.RPCGen.MobileAppState.foreground, version(1, testEpoch + 1000))
    expect(useShellState.getState().mobileAppState).toBe('active')
  })

  test('arrives in the subscribe snapshot, which is what catches a late-started JS up', () => {
    applyClientState({appState: T.RPCGen.MobileAppState.background, version: version(1)})
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('a service too old to send one leaves the state unknown and burns no version', () => {
    applyMobileAppState(undefined, version(1))
    expect(useShellState.getState().mobileAppState).toBe('unknown')
    applyMobileAppState(T.RPCGen.MobileAppState.background, version(1))
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('desktop has no lifecycle to learn, so its constant FOREGROUND is ignored', () => {
    g.isMobile = false
    applyMobileAppState(T.RPCGen.MobileAppState.foreground, version(1))
    expect(useShellState.getState().mobileAppState).toBe('unknown')
  })
})
