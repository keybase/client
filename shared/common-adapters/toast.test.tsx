/** @jest-environment jsdom */
/// <reference types="jest" />

jest.mock('react-native', () => ({
  ...(jest.requireActual('react-native') as object),
  useColorScheme: () => 'light',
}))

import {cleanup, render, screen} from '@testing-library/react'
import Toast from './toast'

describe('Toast on desktop', () => {
  afterEach(() => {
    cleanup()
  })

  // an unanchored toast stays mounted while hidden, so nothing it renders may
  // catch clicks meant for the screen under it
  test.each([true, false])('unanchored toast never takes pointer events (visible=%s)', visible => {
    render(<Toast visible={visible}>toast text</Toast>)
    let el: HTMLElement | null = screen.getByText('toast text')
    let blocked = false
    while (el && el !== document.body) {
      if (el.classList.contains('box2_pointerEvents_none')) {
        blocked = true
        break
      }
      el = el.parentElement
    }
    expect(blocked).toBe(true)
  })
})
