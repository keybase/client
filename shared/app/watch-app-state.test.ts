/// <reference types="jest" />
import {inactiveRecheckMs, watchAppState, type MobileAppState} from './watch-app-state'

const makeAppState = (currentState: string | null) => {
  let listener: ((state: string) => void) | undefined
  const remove = jest.fn(() => {
    listener = undefined
  })
  return {
    appState: {
      addEventListener: (_type: 'change', l: (state: string) => void) => {
        listener = l
        return {remove}
      },
      currentState,
    },
    emit: (state: string) => listener?.(state),
    remove,
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

test('seeds from the current state when subscribing', () => {
  const {appState} = makeAppState('active')
  const states = new Array<MobileAppState>()
  const stop = watchAppState({appState, onState: s => states.push(s)})
  expect(states).toEqual(['active'])
  stop()
})

test('ignores states that are not app states', () => {
  const {appState, emit} = makeAppState('unknown')
  const states = new Array<MobileAppState>()
  const stop = watchAppState({appState, onState: s => states.push(s)})
  emit('extension')
  emit('background')
  expect(states).toEqual(['background'])
  stop()
})

test('a stale inactive seed converges to active once native reports it', () => {
  const {appState} = makeAppState('inactive')
  let nativeState = 'inactive'
  const queryNativeAppState = jest.fn((onState: (s: string) => void) => onState(nativeState))
  const states = new Array<MobileAppState>()
  const stop = watchAppState({appState, onState: s => states.push(s), queryNativeAppState})
  expect(states).toEqual(['inactive'])

  jest.advanceTimersByTime(inactiveRecheckMs)
  expect(queryNativeAppState).toHaveBeenCalledTimes(1)
  expect(states).toEqual(['inactive'])

  nativeState = 'active'
  jest.advanceTimersByTime(inactiveRecheckMs)
  expect(states).toEqual(['inactive', 'active'])

  jest.advanceTimersByTime(inactiveRecheckMs * 10)
  expect(queryNativeAppState).toHaveBeenCalledTimes(2)
  stop()
})

test('a stale inactive change event converges too', () => {
  const {appState, emit} = makeAppState('background')
  const queryNativeAppState = jest.fn((onState: (s: string) => void) => onState('active'))
  const states = new Array<MobileAppState>()
  const stop = watchAppState({appState, onState: s => states.push(s), queryNativeAppState})
  emit('inactive')
  jest.advanceTimersByTime(inactiveRecheckMs)
  expect(states).toEqual(['background', 'inactive', 'active'])
  stop()
})

test('a real change wins over a recheck that answers late', () => {
  const {appState, emit} = makeAppState('inactive')
  let answer: ((s: string) => void) | undefined
  const queryNativeAppState = (onState: (s: string) => void) => {
    answer = onState
  }
  const states = new Array<MobileAppState>()
  const stop = watchAppState({appState, onState: s => states.push(s), queryNativeAppState})
  jest.advanceTimersByTime(inactiveRecheckMs)
  emit('background')
  answer?.('active')
  expect(states).toEqual(['inactive', 'background'])
  stop()
})

test('stopping removes the listener and pending rechecks', () => {
  const {appState, remove} = makeAppState('inactive')
  const queryNativeAppState = jest.fn()
  const stop = watchAppState({appState, onState: () => {}, queryNativeAppState})
  stop()
  jest.advanceTimersByTime(inactiveRecheckMs * 4)
  expect(queryNativeAppState).not.toHaveBeenCalled()
  expect(remove).toHaveBeenCalled()
})
