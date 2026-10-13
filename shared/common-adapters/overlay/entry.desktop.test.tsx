/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {KeyEventHandler} from '../key-event-handler.desktop'
import {EscapeHandler, paintOrder} from '@/test/overlay-dom.desktop'
import {OverlayEntry} from './entry.desktop'

type ModalProps = {
  children?: React.ReactNode
  onEscape?: () => void
  // a router modal, not a cover or dialog
  route?: boolean
  stoppedEscapeCloses?: boolean
}
const Modal = (p: ModalProps) => (
  <OverlayEntry
    acceptsKeys={true}
    blocking={true}
    kind="modal"
    onEscape={p.onEscape}
    route={p.route}
    stoppedEscapeCloses={p.stoppedEscapeCloses ?? true}
  >
    {p.children}
  </OverlayEntry>
)

const entries = () => [...document.querySelectorAll<HTMLElement>('#modal-root > [data-overlay-entry]')]
const appRoot = () => document.getElementById('root')

const pressEscape = (target: Element = document.body) => {
  const ev = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'})
  act(() => {
    target.dispatchEvent(ev)
  })
  return ev
}

const stop = (e: React.KeyboardEvent) => e.stopPropagation()

describe('OverlayEntry', () => {
  beforeEach(() => {
    const root = document.createElement('div')
    root.id = 'root'
    const modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.append(root, modalRoot)
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  test('is drawn in the modal root while mounted, and gone on unmount', () => {
    const {unmount} = render(<Modal>content</Modal>)
    const [entry] = entries()
    expect(paintOrder()).toEqual([entry])
    expect(entry?.textContent).toBe('content')
    unmount()
    expect(entries()).toEqual([])
  })

  test('each entry is drawn above the ones under it in the stack, whatever order they mounted in', () => {
    const Stack = (p: {second: boolean}) => (
      <>
        {p.second ? <Modal>second</Modal> : null}
        <OverlayEntry acceptsKeys={false} blocking={false} kind="global" stoppedEscapeCloses={false} tier="globalError">
          banner
        </OverlayEntry>
        <Modal>
          first<Modal>child</Modal>
        </Modal>
      </>
    )
    const {rerender} = render(<Stack second={false} />)
    rerender(<Stack second={true} />)
    const zIndexes = paintOrder().map(e => Number(e.style.zIndex))
    expect(paintOrder().map(e => e.textContent)).toEqual(['first', 'child', 'second', 'banner'])
    expect(zIndexes).toEqual([...zIndexes].sort((a, b) => a - b))
    expect(new Set(zIndexes).size).toBe(zIndexes.length)
  })

  // a <dialog> shown with showModal is a close watcher, which Chromium closes after enough Escapes
  test('is not a dialog, so nothing but the overlay stack closes it', () => {
    render(<Modal>content</Modal>)
    const [entry] = entries()
    expect(entry?.tagName).toBe('DIV')
    expect(document.querySelector('dialog')).toBeNull()
  })

  test('mounts its content once the entry is in the stack, so what opens from it stacks above it', () => {
    let inStackWhenMounted: boolean | undefined
    const Content = () => {
      const ref = React.useRef<HTMLDivElement>(null)
      React.useLayoutEffect(() => {
        const entry = ref.current?.closest<HTMLElement>('[data-overlay-entry]')
        inStackWhenMounted = !!entry && entry.style.zIndex !== ''
      }, [])
      return <div ref={ref}>content</div>
    }
    render(
      <Modal>
        <Content />
        <input aria-label="field" autoFocus={true} />
      </Modal>
    )
    expect(inStackWhenMounted).toBe(true)
    expect(document.activeElement).toBe(screen.getByLabelText('field'))
  })

  test('takes focus itself when nothing inside does', () => {
    render(<Modal>content</Modal>)
    expect(document.activeElement).toBe(entries()[0])
  })

  test('makes the app and everything under it inert', () => {
    const Stack = (p: {second: boolean}) => (
      <>
        <Modal>first</Modal>
        {p.second ? <Modal>second</Modal> : null}
      </>
    )
    const {rerender} = render(<Stack second={false} />)
    expect(appRoot()?.hasAttribute('inert')).toBe(true)
    rerender(<Stack second={true} />)
    const [first, second] = entries()
    expect(first?.hasAttribute('inert')).toBe(true)
    expect(second?.hasAttribute('inert')).toBe(false)
    rerender(<Stack second={false} />)
    expect(first?.hasAttribute('inert')).toBe(false)
    rerender(<></>)
    expect(appRoot()?.hasAttribute('inert')).toBe(false)
  })

  describe('what stays drawn under a blocking entry', () => {
    const Menu = (p: {children?: React.ReactNode}) => (
      <OverlayEntry acceptsKeys={true} blocking={false} kind="popup" stoppedEscapeCloses={false}>
        {p.children}
      </OverlayEntry>
    )
    const isHidden = (text: string) =>
      entries()
        .find(e => e.firstChild?.textContent === text)
        ?.hasAttribute('data-hidden')

    test('a router modal under a confirm opened from it, and its menu', () => {
      const App = (p: {confirm: boolean}) => (
        <Modal route={true}>
          <span>route</span>
          <Menu>
            <span>menu</span>
          </Menu>
          {p.confirm ? (
            <Modal>
              <span>confirm</span>
            </Modal>
          ) : null}
        </Modal>
      )
      const {rerender} = render(<App confirm={false} />)
      rerender(<App confirm={true} />)
      expect(isHidden('route')).toBe(false)
      expect(isHidden('menu')).toBe(true)
      expect(isHidden('confirm')).toBe(false)
    })

    test('a router modal under another router modal, and what is open in it', () => {
      const App = (p: {second: boolean}) => (
        <>
          <Modal route={true}>
            <span>first</span>
            <Modal>
              <span>its confirm</span>
            </Modal>
          </Modal>
          {p.second ? (
            <Modal route={true}>
              <span>second</span>
            </Modal>
          ) : null}
        </>
      )
      const {rerender} = render(<App second={false} />)
      rerender(<App second={true} />)
      expect(isHidden('first')).toBe(true)
      expect(isHidden('its confirm')).toBe(true)
      expect(isHidden('second')).toBe(false)
      rerender(<App second={false} />)
      expect(isHidden('first')).toBe(false)
      expect(isHidden('its confirm')).toBe(false)
    })
  })

  test('a covered modal keeps its place and content', () => {
    const Stack = (p: {second: boolean}) => (
      <>
        <Modal>
          <input aria-label="kept" defaultValue="typed" />
          <Modal>popup-like child</Modal>
        </Modal>
        {p.second ? <Modal>second</Modal> : null}
      </>
    )
    const {rerender} = render(<Stack second={false} />)
    const [outer, inner] = entries()
    rerender(<Stack second={true} />)
    expect(paintOrder()).toEqual([outer, inner, entries()[2]])
    rerender(<Stack second={false} />)
    expect(paintOrder()).toEqual([outer, inner])
    expect(screen.getByLabelText<HTMLInputElement>('kept').value).toBe('typed')
  })

  test('closing a modal with a popup open in it leaves the modal under it alone', () => {
    const Stack = (p: {second: boolean}) => (
      <>
        <Modal>
          <input aria-label="field" />
        </Modal>
        {p.second ? (
          <Modal>
            <OverlayEntry acceptsKeys={true} blocking={false} kind="popup" stoppedEscapeCloses={false}>
              menu
            </OverlayEntry>
          </Modal>
        ) : null}
      </>
    )
    const {rerender} = render(<Stack second={false} />)
    const [first] = entries()
    const field = screen.getByLabelText('field')
    field.focus()
    rerender(<Stack second={true} />)
    const refocused = jest.fn()
    field.addEventListener('focus', refocused)
    rerender(<Stack second={false} />)
    expect(paintOrder()).toEqual([first])
    expect(document.activeElement).toBe(field)
    expect(refocused).toHaveBeenCalledTimes(1)
  })

  describe('focus', () => {
    test('goes back to what opened it when it closes', () => {
      const App = (p: {open: boolean}) => (
        <>
          <button>opener</button>
          {p.open ? <Modal>content</Modal> : null}
        </>
      )
      const {rerender} = render(<App open={false} />)
      const opener = screen.getByText('opener')
      opener.focus()
      rerender(<App open={true} />)
      expect(document.activeElement).toBe(entries()[0])
      rerender(<App open={false} />)
      expect(document.activeElement).toBe(opener)
    })

    test('goes back into the modal under it, to where it last was', () => {
      const Stack = (p: {second: boolean}) => (
        <>
          <Modal>
            <input aria-label="first field" />
            <input aria-label="second field" />
          </Modal>
          {p.second ? <Modal>second</Modal> : null}
        </>
      )
      const {rerender} = render(<Stack second={false} />)
      const field = screen.getByLabelText('second field')
      field.focus()
      rerender(<Stack second={true} />)
      expect(document.activeElement).not.toBe(field)
      rerender(<Stack second={false} />)
      expect(document.activeElement).toBe(field)
    })

    test('goes to the modal under it when what opened the closing one is gone', () => {
      const Stack = (p: {second: boolean; item: boolean}) => (
        <>
          <Modal>{p.item ? <button>menu item</button> : null}</Modal>
          {p.second ? <Modal>second</Modal> : null}
        </>
      )
      const {rerender} = render(<Stack second={false} item={true} />)
      screen.getByText('menu item').focus()
      rerender(<Stack second={true} item={true} />)
      rerender(<Stack second={true} item={false} />)
      rerender(<Stack second={false} item={false} />)
      expect(document.activeElement).toBe(entries()[0])
    })

    test('is left alone when it is somewhere else when the entry closes', () => {
      const App = (p: {open: boolean}) => (
        <>
          <button>opener</button>
          <input aria-label="elsewhere" />
          {p.open ? <Modal>content</Modal> : null}
        </>
      )
      const {rerender} = render(<App open={false} />)
      screen.getByText('opener').focus()
      rerender(<App open={true} />)
      // nothing in the app can take focus while it is inert, but it is not this entry's to move
      const elsewhere = screen.getByLabelText('elsewhere')
      elsewhere.focus()
      rerender(<App open={false} />)
      expect(document.activeElement).toBe(elsewhere)
    })
  })

  describe('Escape', () => {
    test('goes to the topmost modal, not to handlers outside it', () => {
      const outside = jest.fn()
      const onEscape = jest.fn()
      const Outside = () => <EscapeHandler onESC={outside}>outside</EscapeHandler>
      const {rerender} = render(
        <>
          <Modal onEscape={onEscape}>content</Modal>
          <Outside />
        </>
      )
      const ev = pressEscape()
      expect(onEscape).toHaveBeenCalledTimes(1)
      expect(outside).not.toHaveBeenCalled()
      expect(ev.defaultPrevented).toBe(true)

      rerender(<Outside />)
      pressEscape()
      expect(outside).toHaveBeenCalledTimes(1)
      expect(onEscape).toHaveBeenCalledTimes(1)
    })

    test('a handler inside takes it before the modal does', () => {
      const onEscape = jest.fn()
      const inside = jest.fn()
      const {rerender} = render(
        <Modal onEscape={onEscape}>
          <EscapeHandler onESC={inside}>popup</EscapeHandler>
        </Modal>
      )
      pressEscape()
      expect(inside).toHaveBeenCalledTimes(1)
      expect(onEscape).not.toHaveBeenCalled()

      rerender(<Modal onEscape={onEscape}>no popup</Modal>)
      pressEscape()
      expect(onEscape).toHaveBeenCalledTimes(1)
    })

    // e.g. a chat input inside the modal listens for keys but leaves Escape alone
    test('a handler inside that leaves it alone does not keep the modal open', () => {
      const onEscape = jest.fn()
      const onKeyDown = jest.fn()
      render(
        <Modal onEscape={onEscape}>
          <KeyEventHandler onKeyDown={onKeyDown}>content</KeyEventHandler>
        </Modal>
      )
      expect(pressEscape().defaultPrevented).toBe(true)
      expect(onKeyDown).toHaveBeenCalledTimes(1)
      expect(onEscape).toHaveBeenCalledTimes(1)
    })

    test('a handler inside takes it by preventing its default', () => {
      const onEscape = jest.fn()
      render(
        <Modal onEscape={onEscape}>
          <KeyEventHandler onKeyDown={(ev: KeyboardEvent) => ev.preventDefault()}>content</KeyEventHandler>
        </Modal>
      )
      pressEscape()
      expect(onEscape).not.toHaveBeenCalled()
    })

    // overlayNoClose and the account-reset cover
    test('a modal without onEscape keeps it from everything under it', () => {
      const outer = jest.fn()
      const outside = jest.fn()
      render(
        <>
          <EscapeHandler onESC={outside}>outside</EscapeHandler>
          <Modal onEscape={outer}>
            <Modal>inner</Modal>
          </Modal>
        </>
      )
      expect(pressEscape().defaultPrevented).toBe(true)
      expect(outer).not.toHaveBeenCalled()
      expect(outside).not.toHaveBeenCalled()
    })

    test('the most recently opened modal takes it', () => {
      const first = jest.fn()
      const second = jest.fn()
      const Stack = (p: {first: boolean}) => (
        <>
          {p.first ? <Modal onEscape={first}>first</Modal> : null}
          <Modal onEscape={second}>second</Modal>
        </>
      )
      const {rerender} = render(<Stack first={true} />)
      pressEscape()
      expect(second).toHaveBeenCalledTimes(1)
      rerender(<Stack first={false} />)
      rerender(<Stack first={true} />)
      pressEscape()
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
    })

    test('from a field inside bubbles to the modal', () => {
      const onEscape = jest.fn()
      render(
        <Modal onEscape={onEscape}>
          <input aria-label="field" />
        </Modal>
      )
      fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
      expect(onEscape).toHaveBeenCalledTimes(1)
    })

    describe('that a field stopped', () => {
      beforeEach(() => {
        jest.useFakeTimers()
      })
      afterEach(() => {
        jest.useRealTimers()
      })

      test('reaches the modal once the event is done, through the handlers inside it', () => {
        const onEscape = jest.fn()
        const inside = jest.fn()
        const {rerender} = render(
          <Modal onEscape={onEscape}>
            <EscapeHandler onESC={inside}>
              <input aria-label="field" onKeyDown={stop} />
            </EscapeHandler>
          </Modal>
        )
        fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
        expect(inside).not.toHaveBeenCalled()
        act(() => {
          jest.runAllTimers()
        })
        expect(inside).toHaveBeenCalledTimes(1)
        expect(onEscape).not.toHaveBeenCalled()

        rerender(
          <Modal onEscape={onEscape}>
            <input aria-label="field" onKeyDown={stop} />
          </Modal>
        )
        fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
        act(() => {
          jest.runAllTimers()
        })
        expect(onEscape).toHaveBeenCalledTimes(1)
      })

      test('is left to a field that also prevented it', () => {
        const onEscape = jest.fn()
        const handle = (e: React.KeyboardEvent) => {
          e.preventDefault()
          e.stopPropagation()
        }
        render(
          <Modal onEscape={onEscape}>
            <input aria-label="field" onKeyDown={handle} />
          </Modal>
        )
        fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
        act(() => {
          jest.runAllTimers()
        })
        expect(onEscape).not.toHaveBeenCalled()
      })

      test('is left to the field when the modal says so', () => {
        const onEscape = jest.fn()
        render(
          <Modal onEscape={onEscape} stoppedEscapeCloses={false}>
            <input aria-label="field" onKeyDown={stop} />
          </Modal>
        )
        fireEvent.keyDown(screen.getByLabelText('field'), {key: 'Escape'})
        act(() => {
          jest.runAllTimers()
        })
        expect(onEscape).not.toHaveBeenCalled()
      })

      test('is dropped when another modal took the keys meanwhile', () => {
        const first = jest.fn()
        const second = jest.fn()
        const Stack = (p: {second: boolean}) => (
          <>
            <Modal onEscape={first}>
              <input aria-label="field" onKeyDown={stop} />
            </Modal>
            {p.second ? <Modal onEscape={second}>second</Modal> : null}
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
        render(<Modal onEscape={onEscape}>content</Modal>)
        pressEscape()
        act(() => {
          jest.runAllTimers()
        })
        expect(onEscape).toHaveBeenCalledTimes(1)
      })
    })
  })

  test('renders nothing without a modal root', () => {
    document.getElementById('modal-root')?.remove()
    const {container} = render(<Modal>content</Modal>)
    expect(container.innerHTML).toBe('')
  })
})
