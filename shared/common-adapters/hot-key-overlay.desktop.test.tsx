/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, render} from '@testing-library/react'
import {OverlayEntry} from './overlay/entry.desktop'
import {EscapeHandler, setupOverlayDom} from '@/test/overlay-dom.desktop'

jest.mock('@/constants', () => ({
  Router2: {
    useSafeFocusEffect: (cb: () => (() => void) | undefined) => require('react').useEffect(cb, [cb]),
  },
}))
jest.mock('@/constants/platform', () => ({isMac: true}))

import {useHotKey} from './hot-key'

setupOverlayDom()

const HotKey = (p: {keys: string; cb: () => void}) => {
  useHotKey(p.keys, p.cb)
  return null
}

const press = (key: string, metaKey = false) => {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key, metaKey})
  act(() => {
    document.body.dispatchEvent(event)
  })
  return event
}
const pressEscape = () => press('Escape')

const Modal = (p: {children?: React.ReactNode; onEscape?: () => void}) => (
  <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" onEscape={p.onEscape}>
    {p.children}
  </OverlayEntry>
)

describe('useHotKey with modals', () => {

  // e.g. thread search behind a router modal must not take the Escape that closes the modal
  test('a hot key from under the topmost modal does not fire, and the modal gets the key', () => {
    const behind = jest.fn()
    const onEscape = jest.fn()
    render(
      <>
        <HotKey keys="esc" cb={behind} />
        <Modal onEscape={onEscape}>modal</Modal>
      </>
    )
    pressEscape()
    expect(behind).not.toHaveBeenCalled()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a hot key from inside the topmost modal fires', () => {
    const inside = jest.fn()
    const onEscape = jest.fn()
    render(
      <>
        <Modal onEscape={onEscape}>
          <HotKey keys="esc" cb={inside} />
        </Modal>
      </>
    )
    pressEscape()
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()
  })

  test('a hot key from a modal covered by another does not fire', () => {
    const covered = jest.fn()
    render(
      <>
        <Modal>
          <HotKey keys="esc" cb={covered} />
          <Modal>top</Modal>
        </Modal>
      </>
    )
    pressEscape()
    expect(covered).not.toHaveBeenCalled()
  })

  // hot keys and key handlers both ask the overlay stack which overlay has the keys
  test('a hot key and a key handler agree on which overlay has the keys', () => {
    const rootHotKey = jest.fn()
    const rootEscape = jest.fn()
    const overlayHotKey = jest.fn()
    const overlayEscape = jest.fn()
    // the root's hot key and handler register after the overlay's, as a screen focused again does
    const App = (p: {overlay: boolean}) => (
      <>
        {p.overlay ? (
          <Modal onEscape={overlayEscape}>
            <HotKey keys="mod+k" cb={overlayHotKey} />
          </Modal>
        ) : null}
        <HotKey keys="mod+k" cb={rootHotKey} />
        <EscapeHandler onESC={rootEscape}>root</EscapeHandler>
      </>
    )
    const {rerender} = render(<App overlay={true} />)
    press('k', true)
    pressEscape()
    expect(overlayHotKey).toHaveBeenCalledTimes(1)
    expect(overlayEscape).toHaveBeenCalledTimes(1)
    expect(rootHotKey).not.toHaveBeenCalled()
    expect(rootEscape).not.toHaveBeenCalled()

    rerender(<App overlay={false} />)
    press('k', true)
    pressEscape()
    expect(rootHotKey).toHaveBeenCalledTimes(1)
    expect(rootEscape).toHaveBeenCalledTimes(1)
  })

  test('with no modal open hot keys fire as usual', () => {
    const cb = jest.fn()
    render(<HotKey keys="esc" cb={cb} />)
    pressEscape()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
