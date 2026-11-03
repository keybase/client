/** @jest-environment jsdom */
/// <reference types="jest" />
import lottie from 'lottie-web'
import {act, cleanup, render} from '@testing-library/react'
import Animation from './animation'
import animationData from './animation-data.json'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

test('desktop plays the animation into its element, and destroys it on unmount', async () => {
  const destroy = jest.fn()
  const load = jest.spyOn(lottie, 'loadAnimation').mockReturnValue({destroy} as never)
  const {unmount} = render(<Animation animationType="spinner" />)
  // lottie-web is imported lazily
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(load).toHaveBeenCalledTimes(1)
  const {animationData: data, container: el} = load.mock.calls[0]![0] as {animationData: unknown; container: Element}
  expect(data).toBe(animationData.spinner)
  expect((el as unknown as {isConnected: boolean}).isConnected).toBe(true)

  unmount()
  expect(destroy).toHaveBeenCalledTimes(1)
})

test('unmounted before lottie-web loads, nothing is played', async () => {
  const load = jest.spyOn(lottie, 'loadAnimation')
  const {unmount} = render(<Animation animationType="spinner" />)
  unmount()
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(load).not.toHaveBeenCalled()
})
