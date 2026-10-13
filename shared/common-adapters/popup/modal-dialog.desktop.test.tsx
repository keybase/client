/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {EscapeHandler, KeyEventHandler} from '../key-event-handler.desktop'
import {AboveModalDialogs} from './above-modal-dialogs.desktop'
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

const MountCounter = (p: {onMount: () => void}) => {
  const {onMount} = p
  React.useEffect(() => {
    onMount()
  }, [onMount])
  return <div>banner</div>
}

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
      <>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
        <Outside />
      </>
    )
    const ev = pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(outside).not.toHaveBeenCalled()
    // handled here, so the browser must not also close the dialog
    expect(ev.defaultPrevented).toBe(true)

    rerender(
      <>
        <Outside />
      </>
    )
    pressEscape()
    expect(outside).toHaveBeenCalledTimes(1)
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a handler outside registered after the dialog opened still does not get escape', () => {
    const outside = jest.fn()
    const onEscape = jest.fn()
    const {rerender} = render(
      <>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
      </>
    )
    rerender(
      <>
        <ModalDialog onEscape={onEscape}>content</ModalDialog>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
      </>
    )
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(outside).not.toHaveBeenCalled()
  })

  test('a handler inside the dialog takes escape before the dialog does', () => {
    const onEscape = jest.fn()
    const inside = jest.fn()
    const {rerender} = render(
      <>
        <ModalDialog onEscape={onEscape}>
          <EscapeHandler onESC={inside}>popup</EscapeHandler>
        </ModalDialog>
      </>
    )
    pressEscape()
    expect(inside).toHaveBeenCalledTimes(1)
    expect(onEscape).not.toHaveBeenCalled()

    rerender(
      <>
        <ModalDialog onEscape={onEscape}>no popup</ModalDialog>
      </>
    )
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  // e.g. a chat input inside the dialog listens for keys but leaves Escape alone
  test('a handler inside the dialog that leaves escape alone does not keep the dialog open', () => {
    const onEscape = jest.fn()
    const onKeyDown = jest.fn()
    render(
      <>
        <ModalDialog onEscape={onEscape}>
          <KeyEventHandler onKeyDown={onKeyDown}>content</KeyEventHandler>
        </ModalDialog>
      </>
    )
    expect(pressEscape().defaultPrevented).toBe(true)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('a handler inside the dialog takes escape by preventing its default', () => {
    const onEscape = jest.fn()
    render(
      <>
        <ModalDialog onEscape={onEscape}>
          <KeyEventHandler onKeyDown={ev => ev.preventDefault()}>content</KeyEventHandler>
        </ModalDialog>
      </>
    )
    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()
  })

  test('a dialog inside another without onEscape keeps escape from the outer one', () => {
    const outer = jest.fn()
    render(
      <>
        <ModalDialog onEscape={outer}>
          <ModalDialog>inner</ModalDialog>
        </ModalDialog>
      </>
    )
    pressEscape()
    expect(outer).not.toHaveBeenCalled()
  })

  test('without onEscape, escape is still kept from the handlers outside', () => {
    const outside = jest.fn()
    render(
      <>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
        <ModalDialog>content</ModalDialog>
      </>
    )
    expect(pressEscape().defaultPrevented).toBe(true)
    expect(outside).not.toHaveBeenCalled()
  })

  test('the browser cancel is prevented, so only the key handling closes the dialog', () => {
    const onEscape = jest.fn()
    render(<ModalDialog onEscape={onEscape}>content</ModalDialog>)
    const [dialog] = dialogs()
    const cancel = new Event('cancel', {cancelable: true})
    dialog?.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onEscape).not.toHaveBeenCalled()
  })

  describe('an Escape a field stopped', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })
    const stop = (e: React.KeyboardEvent) => e.stopPropagation()

    test('reaches the dialog once the event is done, through the handlers inside it', () => {
      const onEscape = jest.fn()
      const inside = jest.fn()
      const {rerender} = render(
        <ModalDialog onEscape={onEscape}>
          <EscapeHandler onESC={inside}>
            <input aria-label="field" onKeyDown={stop} />
          </EscapeHandler>
        </ModalDialog>
      )
      fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
      expect(inside).not.toHaveBeenCalled()
      act(() => {
        jest.runAllTimers()
      })
      expect(inside).toHaveBeenCalledTimes(1)
      expect(onEscape).not.toHaveBeenCalled()

      rerender(
        <ModalDialog onEscape={onEscape}>
          <input aria-label="field" onKeyDown={stop} />
        </ModalDialog>
      )
      fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
      act(() => {
        jest.runAllTimers()
      })
      expect(onEscape).toHaveBeenCalledTimes(1)
    })

    test('is left to the field when the dialog says so', () => {
      const onEscape = jest.fn()
      render(
        <ModalDialog onEscape={onEscape} stoppedEscapeReachesDialog={false}>
          <input aria-label="field" onKeyDown={stop} />
        </ModalDialog>
      )
      fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
      act(() => {
        jest.runAllTimers()
      })
      expect(onEscape).not.toHaveBeenCalled()
    })

    test('is dropped when another dialog took the keys meanwhile', () => {
      const first = jest.fn()
      const second = jest.fn()
      const Stack = (p: {second: boolean}) => (
        <>
          <ModalDialog onEscape={first}>
            <input aria-label="field" onKeyDown={stop} />
          </ModalDialog>
          {p.second ? <ModalDialog onEscape={second}>second</ModalDialog> : null}
        </>
      )
      const {rerender} = render(<Stack second={false} />)
      fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
      rerender(<Stack second={true} />)
      act(() => {
        jest.runAllTimers()
      })
      expect(first).not.toHaveBeenCalled()
      expect(second).not.toHaveBeenCalled()
    })

    test('an Escape nothing stopped is handled once', () => {
      const onEscape = jest.fn()
      render(<ModalDialog onEscape={onEscape}>content</ModalDialog>)
      pressEscape()
      act(() => {
        jest.runAllTimers()
      })
      expect(onEscape).toHaveBeenCalledTimes(1)
    })
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
      <>
        <ModalDialog open={p.firstOpen} onEscape={first}>
          first
        </ModalDialog>
        {p.showSecond ? <ModalDialog onEscape={second}>second</ModalDialog> : null}
      </>
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
      <>
        <EscapeHandler onESC={outside}>outside</EscapeHandler>
        <ModalDialog open={false} onEscape={onEscape}>
          content
        </ModalDialog>
      </>
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
      <>
        <ModalDialog onEscape={onEscape}>
          <input aria-label="field" />
        </ModalDialog>
      </>
    )
    fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('app-wide overlays render inside the topmost dialog while one is open', () => {
    const App = (p: {modals: number}) => (
      <>
        {p.modals > 0 ? (
          <ModalDialog>
            outer
            {p.modals > 1 ? <ModalDialog>inner</ModalDialog> : null}
          </ModalDialog>
        ) : null}
        <AboveModalDialogs>
          <div>banner</div>
        </AboveModalDialogs>
      </>
    )
    const {rerender} = render(<App modals={0} />)
    const banner = () => screen.getByText('banner')
    expect(banner().closest('dialog')).toBeNull()
    rerender(<App modals={2} />)
    expect(banner().closest('dialog')).toBe(dialogs()[1])
    rerender(<App modals={1} />)
    expect(banner().closest('dialog')).toBe(dialogs()[0])
    rerender(<App modals={0} />)
    expect(banner().closest('dialog')).toBeNull()
  })

  // the global error banner keeps whether it is expanded and its dismiss timer
  test('app-wide overlays keep their state as dialogs open and close', () => {
    const onMount = jest.fn()
    const App = (p: {modal: boolean}) => (
      <>
        {p.modal ? <ModalDialog>modal</ModalDialog> : null}
        <AboveModalDialogs>
          <MountCounter onMount={onMount} />
        </AboveModalDialogs>
      </>
    )
    const {rerender} = render(<App modal={false} />)
    rerender(<App modal={true} />)
    expect(screen.getByText('banner').closest('dialog')).toBe(dialogs()[0])
    rerender(<App modal={false} />)
    expect(onMount).toHaveBeenCalledTimes(1)
  })

  // showModal would focus the first focusable thing in a dialog that already has content
  test('a reopened dialog puts focus back where it was when another opened over it', () => {
    const Stack = (p: {firstOpen: boolean; second: boolean}) => (
      <>
        <ModalDialog open={p.firstOpen}>
          <input aria-label="first field" />
          <input aria-label="second field" />
        </ModalDialog>
        {p.second ? <ModalDialog>second</ModalDialog> : null}
      </>
    )
    const {rerender} = render(<Stack firstOpen={true} second={false} />)
    const field = screen.getByLabelText('second field')
    field.focus()
    rerender(<Stack firstOpen={true} second={true} />)
    rerender(<Stack firstOpen={false} second={true} />)
    document.body.focus()
    rerender(<Stack firstOpen={false} second={false} />)
    rerender(<Stack firstOpen={true} second={false} />)
    expect(document.activeElement).toBe(field)

    // with nothing saved, the dialog itself
    rerender(<Stack firstOpen={false} second={false} />)
    rerender(<Stack firstOpen={true} second={false} />)
    expect(document.activeElement).toBe(dialogs()[0])
  })
})
