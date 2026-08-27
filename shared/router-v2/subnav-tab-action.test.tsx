/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, renderHook} from '@testing-library/react'
import {useSubnavTabAction} from './common'

const makeNav = (emitResult?: {defaultPrevented: boolean}) => ({
  dispatch: jest.fn(),
  emit: jest.fn(() => emitResult ?? {defaultPrevented: false}),
})

const state = {
  index: 0,
  key: 'stack-key',
  routes: [
    {key: 'settingsRoot-key', name: 'settingsRoot'},
    {key: 'settingsAccount-key', name: 'settingsAccount'},
  ],
} as never

afterEach(() => {
  cleanup()
})

const render = (nav: ReturnType<typeof makeNav>) =>
  renderHook(() => useSubnavTabAction(nav as never, state)).result.current

test('selecting a tab emits tabPress at that route and jumps to it', () => {
  const nav = makeNav()

  render(nav)('settingsAccount')

  expect(nav.emit).toHaveBeenCalledWith({
    canPreventDefault: true,
    target: 'settingsAccount-key',
    type: 'tabPress',
  })
  expect(nav.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({target: 'stack-key'})
  )
})

test('a screen that handles tabPress itself blocks the jump', () => {
  const nav = makeNav({defaultPrevented: true})

  render(nav)('settingsAccount')

  expect(nav.dispatch).not.toHaveBeenCalled()
})

test('a tab with no mounted route still jumps without emitting', () => {
  const nav = makeNav()

  render(nav)('settingsNotMounted')

  expect(nav.emit).not.toHaveBeenCalled()
  expect(nav.dispatch).toHaveBeenCalledWith(expect.objectContaining({target: 'stack-key'}))
})

test('the jump action names the requested tab', () => {
  const nav = makeNav()

  render(nav)('settingsRoot')

  const action = nav.dispatch.mock.calls[0]?.[0] as {payload?: {name?: string}}
  expect(action.payload?.name).toBe('settingsRoot')
})
