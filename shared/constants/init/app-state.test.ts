/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import {applyMobileAppState, _onEngineIncoming} from './shared'

const g = globalThis as unknown as {isMobile: boolean}

beforeEach(() => {
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
    applyMobileAppState(state)
    expect(useShellState.getState().mobileAppState).toBe(expected)
  })

  test('arrives through the notification', () => {
    _onEngineIncoming({
      payload: {params: {state: T.RPCGen.MobileAppState.background}},
      type: 'keybase.1.NotifyApp.mobileAppStateChanged',
    } as never)
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('is applied in arrival order: the service sends it on one ordered stream', () => {
    applyMobileAppState(T.RPCGen.MobileAppState.background)
    applyMobileAppState(T.RPCGen.MobileAppState.foreground)
    expect(useShellState.getState().mobileAppState).toBe('active')
  })

  test('a state we do not map leaves the app state alone rather than guessing', () => {
    applyMobileAppState(T.RPCGen.MobileAppState.background)
    applyMobileAppState(99 as T.RPCGen.MobileAppState)
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('desktop has no lifecycle to learn, so its constant FOREGROUND is ignored', () => {
    g.isMobile = false
    applyMobileAppState(T.RPCGen.MobileAppState.foreground)
    expect(useShellState.getState().mobileAppState).toBe('unknown')
  })
})
