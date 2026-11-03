/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'

import {setImmediate} from 'node:timers'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {cancelProvision, submitProvisionUsername} from './flow'

import {installNavigation, makeRootState, stackKeyOf, type InstalledNavigation} from '@/test/navigation'
import ProvisionWaitingOverlay from './waiting-overlay'

describe('ProvisionWaitingOverlay', () => {
  let nav: InstalledNavigation

  // The overlay as provisioning shows it: inside the code page, a route of the logged-out stack.
  const render = () => {
    nav = installNavigation({
      rootState: makeRootState({above: [{name: 'codePage'}], loggedIn: false}),
      screen: r => (r.name === 'codePage' ? <ProvisionWaitingOverlay /> : null),
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    nav.unmount()
    cleanup()
    jest.useRealTimers()
    cancelProvision()
    // a logout keeps in-flight waiting counts, and some tests end mid-wait
    useWaitingState.getState().dispatch.clear(waitingKeyProvision)
    resetAllStores()
  })

  const startWaiting = () => act(() => useWaitingState.getState().dispatch.increment(waitingKeyProvision))
  const stopWaiting = () => act(() => useWaitingState.getState().dispatch.decrement(waitingKeyProvision))
  const codePage = () => nav.getRootState()?.routes?.[0]?.state?.routes.find(r => r.name === 'codePage')
  const dispatch = (action: Parameters<typeof navigationRef.dispatch>[0]) => act(() => navigationRef.dispatch(action))
  // the overlay: the screen's veil, drawn in the theme's translucent white, with the spinner in it
  const overlay = () =>
    [...document.querySelectorAll<HTMLElement>('.box2_vertical')].find(
      el => el.style.backgroundColor === 'var(--color-white_75)'
    )
  const spinner = () => overlay()?.querySelector('.box2_alignSelf_center') ?? null
  const provisionWaits = () => useWaitingState.getState().counts.get(waitingKeyProvision) ?? 0

  // A real provisioning attempt: its login RPC held open by the service, the waiting key up while it
  // is. Pausing cancels the attempt, which settles the RPC and drops the key.
  let fake: FakeEngine
  // The IPC hop is a real setImmediate; the engine's 0ms timers are the test's fake ones.
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await new Promise<void>(resolve => setImmediate(resolve))
        jest.advanceTimersByTime(0)
        await new Promise<void>(resolve => setImmediate(resolve))
      })
    }
  }
  const startAttempt = async () => {
    fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.login')
    fake.hold('keybase.1.config.getBootstrapStatus')
    act(() => submitProvisionUsername('testuser'))
    await settle()
    expect(held).toHaveLength(1)
    expect(provisionWaits()).toBe(1)
  }
  // The attempt was cancelled: its RPC settled locally, so nothing waits on provisioning
  const paused = () => provisionWaits() === 0

  test('hidden until 300ms of waiting, cancel affordance at 10s', () => {
    render()
    expect(spinner()).toBeNull()

    startWaiting()
    act(() => jest.advanceTimersByTime(299))
    expect(spinner()).toBeNull()

    act(() => jest.advanceTimersByTime(1))
    expect(spinner()).not.toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()

    act(() => jest.advanceTimersByTime(10000))
    expect(screen.queryByText('Cancel')).not.toBeNull()
  })

  test('overlay box fills its container (desktop Box2 centers abspos children otherwise)', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    const box = overlay()
    expect(box?.classList.contains('box2_fullHeight')).toBe(true)
    expect(box?.classList.contains('box2_fullWidth')).toBe(true)
  })

  test('hides and resets when waiting stops', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    expect(spinner()).not.toBeNull()

    stopWaiting()
    expect(spinner()).toBeNull()
  })

  test('fast RPC never flashes the overlay', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(100))
    stopWaiting()
    act(() => jest.advanceTimersByTime(1000))
    expect(spinner()).toBeNull()
  })

  test('cancel pauses the flow and navigates up', async () => {
    render()
    await startAttempt()
    act(() => jest.advanceTimersByTime(10300))

    act(() => screen.getByText('Cancel').click())
    await settle()
    expect(paused()).toBe(true)
    expect(nav.types()).toContain('GO_BACK')
    expect(codePage()).toBeUndefined()
  })

  test('popping the screen while waiting pauses the flow', async () => {
    render()
    await startAttempt()
    dispatch(StackActions.pop())
    await settle()
    expect(codePage()).toBeUndefined()
    expect(paused()).toBe(true)
  })

  // With nothing waiting on provisioning there is no attempt in flight for a pause to reach.
  test('popping the screen when not waiting just removes it', async () => {
    render()
    dispatch(StackActions.pop())
    await settle()
    expect(codePage()).toBeUndefined()
    expect(nav.visibleScreen()?.name).toBe('login')
  })

  test('going back while waiting pauses the flow', async () => {
    render()
    await startAttempt()
    dispatch(CommonActions.goBack())
    await settle()
    expect(codePage()).toBeUndefined()
    expect(paused()).toBe(true)
  })

  // native-stack's onDismissed dispatches this for a native back or swipe
  test('a native back/swipe dismissal while waiting pauses the flow', async () => {
    render()
    await startAttempt()
    dispatch({...StackActions.dismiss(), source: codePage()?.key, target: stackKeyOf('codePage')})
    await settle()
    expect(codePage()).toBeUndefined()
    expect(paused()).toBe(true)
  })

  test('a non-back removal (e.g. login success unmounting the stack) does not pause', async () => {
    render()
    await startAttempt()
    const rs = nav.getRootState()!
    dispatch(
      CommonActions.reset({
        ...rs,
        index: 0,
        routes: [{...rs.routes![0]!, state: {index: 0, routes: [{key: 'login-0', name: 'login'}]}}],
      } as never)
    )
    await settle()
    expect(codePage()).toBeUndefined()
    expect(paused()).toBe(false)
  })
})
