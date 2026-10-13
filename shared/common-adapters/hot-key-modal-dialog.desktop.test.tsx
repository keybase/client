/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, render} from '@testing-library/react'
import {ModalDialog} from './popup/modal-dialog.desktop'
import {EscapeHandler} from './key-event-handler.desktop'
import {OverlayEntryContext} from './overlay/context'
import {useOverlayEntry} from './overlay/entry.desktop'

jest.mock('@/constants', () => ({
  Router2: {
    useSafeFocusEffect: (cb: () => (() => void) | undefined) => require('react').useEffect(cb, [cb]),
  },
}))
jest.mock('@/constants/platform', () => ({isMac: true}))

import {useHotKey} from './hot-key'

// jsdom has no showModal
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
  }
})

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

// any blocking overlay in the stack, not only a <dialog>
const Blocking = (p: {children: React.ReactNode; onEscape: () => void}) => {
  const entry = useOverlayEntry({
    acceptsKeys: true,
    blocking: true,
    kind: 'modal',
    onEscape: p.onEscape,
    stoppedEscapeCloses: true,
  })
  return <OverlayEntryContext value={entry}>{p.children}</OverlayEntryContext>
}

describe('useHotKey with modal dialogs', () => {
  afterEach(cleanup)

  // e.g. thread search behind a router modal must not take the Escape that closes the modal
  test('a hot key from under the topmost dialog does not fire, and the dialog gets the key', () => {
    const behind = jest.fn()
    const onEscape = jest.fn()
    render(
      <>
        <HotKey keys="esc" cb={behind} />
        <ModalDialog onEscape={onEscape}>modal</ModalDialog>
      </>
    )
    pressEscape()
    expect(behind).not.toHaveBeenCalled()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a hot key from inside the topmost dialog fires', () => {
    const inside = jest.fn()
    const onEscape = jest.fn()
    render(
      <>
        <ModalDialog onEscape={onEscape}>
          <HotKey keys="esc" cb={inside} />
        </ModalDialog>
      </>
    )
    pressEscape()
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()
  })

  test('a hot key from a dialog covered by another does not fire', () => {
    const covered = jest.fn()
    render(
      <>
        <ModalDialog>
          <HotKey keys="esc" cb={covered} />
          <ModalDialog>top</ModalDialog>
        </ModalDialog>
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
          <Blocking onEscape={overlayEscape}>
            <HotKey keys="mod+k" cb={overlayHotKey} />
          </Blocking>
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

  test('with no dialog open hot keys fire as usual', () => {
    const cb = jest.fn()
    render(<HotKey keys="esc" cb={cb} />)
    pressEscape()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
