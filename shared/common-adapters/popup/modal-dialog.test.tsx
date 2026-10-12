/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {EscapeHandler, GlobalKeyEventHandler} from '../key-event-handler.desktop'
import {ModalDialog, useTopModalDialog} from './modal-dialog.desktop'

// jsdom has no showModal, so keep the order dialogs were shown in, which is their top-layer order
let shown: Array<HTMLDialogElement> = []
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    if (this.open) {
      throw new Error('already open')
    }
    this.open = true
    shown.push(this)
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
    shown = shown.filter(d => d !== this)
  }
})

const dialogs = () => [...document.querySelectorAll('dialog')]

const pressEscape = (target: Element = document.body) => {
  const ev = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'})
  target.dispatchEvent(ev)
  return ev
}

describe('ModalDialog', () => {
  beforeEach(() => {
    shown = []
  })
  afterEach(() => {
    cleanup()
  })

  test('is shown with showModal while mounted and closed on unmount', () => {
    const {unmount} = render(<ModalDialog>content</ModalDialog>)
    const [dialog] = dialogs()
    expect(dialog?.open).toBe(true)
    expect(shown).toEqual([dialog])
    unmount()
    expect(shown).toEqual([])
  })

  test('mounts its content into an already open dialog, so it can take focus on mount', () => {
    let openWhenMounted: boolean | undefined
    const Content = () => {
      const ref = React.useRef<HTMLDivElement>(null)
      React.useLayoutEffect(() => {
        openWhenMounted = ref.current?.closest('dialog')?.open
      }, [])
      return <div ref={ref}>content</div>
    }
    render(
      <ModalDialog>
        <Content />
      </ModalDialog>
    )
    expect(openWhenMounted).toBe(true)
  })

  test('escape goes to the dialog, not to handlers outside it', () => {
    const outside = jest.fn()
    const onEscape = jest.fn()
    const Outside = () => <EscapeHandler onESC={outside}>outside</EscapeHandler>
    const {rerender} = render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
        <Outside />
      </GlobalKeyEventHandler>
    )
    const ev = pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(outside).not.toHaveBeenCalled()
    // handled here, so the browser must not also close the dialog
    expect(ev.defaultPrevented).toBe(true)

    rerender(
      <GlobalKeyEventHandler>
        <Outside />
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(outside).toHaveBeenCalledTimes(1)
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a handler outside registered after the dialog opened still does not get escape', () => {
    const outside = jest.fn()
    const onEscape = jest.fn()
    const {rerender} = render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
      </GlobalKeyEventHandler>
    )
    rerender(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(outside).not.toHaveBeenCalled()
  })

  test('a handler inside the dialog takes escape before the dialog does', () => {
    const onEscape = jest.fn()
    const inside = jest.fn()
    const {rerender} = render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>
          <EscapeHandler onESC={inside}>popup</EscapeHandler>
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()

    rerender(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>no popup</ModalDialog>
      </GlobalKeyEventHandler>
    )
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('without onEscape, escape is still kept from the handlers outside', () => {
    const outside = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
        <ModalDialog>content</ModalDialog>
      </GlobalKeyEventHandler>
    )
    expect(pressEscape().defaultPrevented).toBe(true)
    expect(outside).not.toHaveBeenCalled()
  })

  test('a cancel is prevented and routed through the handlers', () => {
    const onEscape = jest.fn()
    const inside = jest.fn()
    const {rerender} = render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>
          <EscapeHandler onESC={inside}>popup</EscapeHandler>
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    const [dialog] = dialogs()
    const cancel = new Event('cancel', {cancelable: true})
    dialog?.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()

    rerender(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>no popup</ModalDialog>
      </GlobalKeyEventHandler>
    )
    dialog?.dispatchEvent(new Event('cancel', {cancelable: true}))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a dialog closed by the browser anyway is shown again', () => {
    render(<ModalDialog>content</ModalDialog>)
    const [dialog] = dialogs()
    act(() => {
      dialog?.close()
      dialog?.dispatchEvent(new Event('close'))
    })
    expect(dialog?.open).toBe(true)
  })

  test('the most recently shown dialog takes escape', () => {
    const first = jest.fn()
    const second = jest.fn()
    const Stack = (p: {firstOpen: boolean; showSecond: boolean}) => (
      <GlobalKeyEventHandler>
        <ModalDialog open={p.firstOpen} onEscape={first}>
          first
        </ModalDialog>
        {p.showSecond ? <ModalDialog onEscape={second}>second</ModalDialog> : null}
      </GlobalKeyEventHandler>
    )
    const {rerender} = render(<Stack firstOpen={true} showSecond={true} />)
    pressEscape()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    // closing and reopening the first moves it on top
    rerender(<Stack firstOpen={false} showSecond={true} />)
    rerender(<Stack firstOpen={true} showSecond={true} />)
    pressEscape()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('a closed dialog keeps its content mounted but takes no keys', () => {
    const onEscape = jest.fn()
    const outside = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
        <ModalDialog open={false} onEscape={onEscape}>
          content
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    // it was never open, so the content waits for it
    expect(screen.queryByText('content')).toBeNull()
    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()
    expect(outside).toHaveBeenCalledTimes(1)
  })

  test('hiding a dialog keeps its content and closes the dialogs inside it, which reopen above it', () => {
    const Nested = (p: {open: boolean}) => (
      <ModalDialog open={p.open}>
        outer
        <ModalDialog>inner</ModalDialog>
      </ModalDialog>
    )
    const {rerender} = render(<Nested open={true} />)
    const [outer, inner] = dialogs()
    expect(shown).toEqual([outer, inner])

    rerender(<Nested open={false} />)
    expect(shown).toEqual([])
    expect(screen.getByText('inner')).toBeTruthy()

    rerender(<Nested open={true} />)
    expect(shown).toEqual([outer, inner])
  })

  test('tracks the topmost open dialog', () => {
    const seen = jest.fn((_top: HTMLDialogElement | null) => {})
    const Top = () => {
      seen(useTopModalDialog())
      return null
    }
    const top = () => seen.mock.lastCall?.[0]
    const {rerender} = render(
      <>
        <Top />
        <ModalDialog>one</ModalDialog>
        <ModalDialog>two</ModalDialog>
      </>
    )
    expect(top()).toBe(dialogs()[1])
    rerender(
      <>
        <Top />
        <ModalDialog>one</ModalDialog>
      </>
    )
    expect(top()).toBe(dialogs()[0])
    rerender(<Top />)
    expect(top()).toBeNull()
  })

  test('escape from inside the dialog bubbles to the handlers', () => {
    const onEscape = jest.fn()
    render(
      <GlobalKeyEventHandler>
        <ModalDialog onEscape={onEscape}>
          <input aria-label="field" />
        </ModalDialog>
      </GlobalKeyEventHandler>
    )
    fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
