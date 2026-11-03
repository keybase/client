/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import logger from '@/logger'
import {fakeNativeKb, type FakeNativeKbModule} from '@/test/fake-native-kb'
import {applyMobileAppState, listenForAppLifecycle} from './shared'

type Lifecycle = 'active' | 'inactive' | 'background'

// what getAppLifecycleState answers; react-native-kb's own wrapper runs over the fake module
let nativeState = 'active'
const mockRNAppStateListeners: Array<(state: string) => void> = []

jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

jest.mock('react-native', () => ({
  ...jest.requireActual<object>('react-native'),
  AppState: {
    addEventListener: (_type: string, cb: (state: string) => void) => {
      mockRNAppStateListeners.push(cb)
      return {remove: () => {}}
    },
    currentState: 'active',
  },
}))

const g = globalThis as unknown as {isMobile: boolean}
const nativeSays = (state: string) => fakeNativeKb.emit('onAppLifecycle', {state})
let stopListening: (() => void) | undefined

beforeEach(() => {
  g.isMobile = true
  resetAllStores()
  // the shell store keeps its state across an account-level reset on purpose
  useShellState.setState({mobileAppState: 'unknown'})
  nativeState = 'active'
  fakeNativeKb.give({getAppLifecycleState: () => nativeState})
  mockRNAppStateListeners.length = 0
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  jest.spyOn(logger, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  stopListening?.()
  stopListening = undefined
  g.isMobile = false
  jest.restoreAllMocks()
})

describe('the app state native reports', () => {
  test.each<Lifecycle>(['active', 'inactive', 'background'])('%s arrives through the native event', state => {
    nativeState = 'background'
    stopListening = listenForAppLifecycle()
    useShellState.setState({mobileAppState: 'unknown'})
    nativeSays(state)
    expect(useShellState.getState().mobileAppState).toBe(state)
  })

  test('is seeded from the state native already holds, since earlier events went to no listener', () => {
    nativeState = 'inactive'
    stopListening = listenForAppLifecycle()
    expect(useShellState.getState().mobileAppState).toBe('inactive')
  })

  test('is applied in arrival order', () => {
    stopListening = listenForAppLifecycle()
    nativeSays('background')
    nativeSays('active')
    expect(useShellState.getState().mobileAppState).toBe('active')
  })

  test('each event is logged with logger.info as [AppState] native: <state>', () => {
    const log = jest.spyOn(logger, 'info').mockImplementation(() => {})
    stopListening = listenForAppLifecycle()
    nativeSays('background')
    expect(log).toHaveBeenCalledWith('[AppState] native: background')
  })

  test('a state we do not map leaves the app state alone rather than guessing', () => {
    stopListening = listenForAppLifecycle()
    nativeSays('background')
    nativeSays('extension')
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('RN AppState change events are ignored', () => {
    stopListening = listenForAppLifecycle()
    nativeSays('active')
    mockRNAppStateListeners.forEach(l => l('background'))
    expect(useShellState.getState().mobileAppState).toBe('active')
  })

  test('stops applying events once unsubscribed', () => {
    const stop = listenForAppLifecycle()
    stop()
    nativeSays('background')
    expect(useShellState.getState().mobileAppState).toBe('active')
    expect(fakeNativeKb.count('onAppLifecycle')).toBe(0)
  })

  test('desktop has no lifecycle to learn', () => {
    g.isMobile = false
    applyMobileAppState('active')
    expect(useShellState.getState().mobileAppState).toBe('unknown')
  })
})
