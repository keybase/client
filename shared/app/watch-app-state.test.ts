/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import {watchAppState} from './watch-app-state'

const makeSource = (initial: string) => {
  let state = initial
  let listener: ((state: string) => void) | undefined
  const unsubscribe = jest.fn(() => {
    listener = undefined
  })
  return {
    emit: (next: string) => {
      state = next
      listener?.(next)
    },
    source: {
      current: () => state,
      subscribe: (l: (state: string) => void) => {
        listener = l
        return unsubscribe
      },
    },
    unsubscribe,
  }
}

const watchIntoStore = (source: Parameters<typeof watchAppState>[0]) =>
  watchAppState(source, useShellState.getState().dispatch.setMobileAppState)

afterEach(() => {
  resetAllStores()
  useShellState.setState({mobileAppState: 'unknown'})
})

test('the store is seeded from the current native state', () => {
  const {source} = makeSource('active')
  const stop = watchIntoStore(source)
  expect(useShellState.getState().mobileAppState).toBe('active')
  stop()
})

test('the store follows every native transition, including a return to a state it already had', () => {
  const {emit, source} = makeSource('active')
  const stop = watchIntoStore(source)
  const seen = new Array<string>()
  const unsub = useShellState.subscribe(s => seen.push(s.mobileAppState))

  emit('inactive')
  emit('active')
  emit('inactive')
  emit('background')
  emit('inactive')
  emit('active')

  expect(seen).toEqual(['inactive', 'active', 'inactive', 'background', 'inactive', 'active'])
  unsub()
  stop()
})

test('a change between subscribing and seeding is not lost', () => {
  const {emit, source} = makeSource('inactive')
  const stop = watchAppState(
    {
      current: source.current,
      // native changes while the listener is being registered, and the event misses it
      subscribe: l => {
        emit('active')
        return source.subscribe(l)
      },
    },
    useShellState.getState().dispatch.setMobileAppState
  )
  expect(useShellState.getState().mobileAppState).toBe('active')
  stop()
})

test('states that are not app states are ignored', () => {
  const {emit, source} = makeSource('unknown')
  const stop = watchIntoStore(source)
  expect(useShellState.getState().mobileAppState).toBe('unknown')
  emit('extension')
  expect(useShellState.getState().mobileAppState).toBe('unknown')
  emit('background')
  expect(useShellState.getState().mobileAppState).toBe('background')
  stop()
})

test('stopping unsubscribes from native', () => {
  const {source, unsubscribe} = makeSource('active')
  watchIntoStore(source)()
  expect(unsubscribe).toHaveBeenCalled()
})
