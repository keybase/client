/** @jest-environment jsdom */
/// <reference types="jest" />

import lottie from 'lottie-web'
import {act, cleanup, render} from '@testing-library/react'
import animationData from './animation-data.json'
import SaveIndicator from './save-indicator'

// the spinner is the real ProgressIndicator, a lottie animation: it is on screen while one is
// loaded into a mounted element and not yet destroyed
const live = new Set<{data: unknown; el: Element}>()
const realLoad = lottie.loadAnimation.bind(lottie)

// lottie-web is imported lazily, so let that land before looking
const spinner = async () => {
  await act(async () => {})
  return [...live].some(a => a.data === animationData.spinner && a.el.isConnected)
}
const check = () => document.querySelector('.icon-gen-iconfont-check')

describe('SaveIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(lottie, 'loadAnimation').mockImplementation(params => {
      const {animationData: data, container: el} = params as unknown as {animationData: unknown; container: Element}
      const anim = realLoad(params)
      const entry = {data, el}
      live.add(entry)
      const destroy = anim.destroy.bind(anim)
      anim.destroy = () => {
        live.delete(entry)
        destroy()
      }
      return anim
    })
  })
  afterEach(() => {
    cleanup()
    live.clear()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('shows nothing before anything has been saved', async () => {
    render(<SaveIndicator saving={false} />)
    expect(await spinner()).toBe(false)
    expect(check()).toBeNull()
  })

  test('mounting mid-save shows the spinner right away, and the check when it finishes', async () => {
    const {rerender} = render(<SaveIndicator saving={true} />)
    expect(await spinner()).toBe(true)
    expect(check()).toBeNull()

    rerender(<SaveIndicator saving={false} />)
    expect(await spinner()).toBe(false)
    expect(check()).not.toBeNull()
  })

  test('flipping to saving shows the spinner', async () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    expect(await spinner()).toBe(true)
    expect(check()).toBeNull()
  })

  test('finishing a save shows the check, then clears after a second', async () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    expect(check()).not.toBeNull()
    expect(document.body.textContent).toContain('Saved')

    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(check()).not.toBeNull()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(check()).toBeNull()
    expect(await spinner()).toBe(false)
  })

  test('a new save started while the check is up goes straight back to the spinner', async () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    expect(check()).not.toBeNull()

    rerender(<SaveIndicator saving={true} />)
    expect(await spinner()).toBe(true)
    expect(check()).toBeNull()

    // the old 'saved' timer must not clear the in-progress spinner
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(await spinner()).toBe(true)
  })

  test('re-rendering with an unchanged saving flag does not restart the clear timer', () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    act(() => {
      jest.advanceTimersByTime(600)
    })
    rerender(<SaveIndicator saving={false} />)
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(check()).toBeNull()
  })
})
