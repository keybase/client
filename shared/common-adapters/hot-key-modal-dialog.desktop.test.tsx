/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, render} from '@testing-library/react'
import {GlobalKeyEventHandler} from './key-event-handler.desktop'
import {ModalDialog} from './popup/modal-dialog.desktop'

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

const pressEscape = () => {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'})
  act(() => {
    document.body.dispatchEvent(event)
  })
  return event
}

describe('useHotKey with modal dialogs', () => {
  afterEach(cleanup)

  // e.g. thread search behind a router modal must not take the Escape that closes the modal
  test('a hot key from under the topmost dialog does not fire, and the dialog gets the key', () => {
    const behind = jest.fn()
    const onEscape = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <HotKey keys="esc" cb={behind} />
        <ModalDialog onEscape={onEscape}>modal</ModalDialog>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(behind).not.toHaveBeenCalled()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a hot key from inside the topmost dialog fires', () => {
    const inside = jest.fn()
    const onEscape = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>
          <HotKey keys="esc" cb={inside} />
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()
  })

  test('a hot key from a dialog covered by another does not fire', () => {
    const covered = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <ModalDialog>
          <HotKey keys="esc" cb={covered} />
          <ModalDialog>top</ModalDialog>
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(covered).not.toHaveBeenCalled()
  })

  test('with no dialog open hot keys fire as usual', () => {
    const cb = jest.fn()
    render(<HotKey keys="esc" cb={cb} />)
    pressEscape()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
