/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {Box2} from '../../box'
import type {MeasureRef} from '../../measure-ref'
import {OverlayEntry} from '../../overlay/entry.desktop'
import {GlobalOverlay} from '../../overlay/global-overlay.desktop'
import {ModalCover} from '../modal-cover.desktop'
import FloatingBox from './index.desktop'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import {EscapeHandler, overlayEntries, setupOverlayDom} from '@/test/overlay-dom.desktop'

const overlay = setupOverlayDom()

// jsdom has no ResizeObserver: keep the observers, so a test can report a size change
let observers: Array<{cb: (entries: Array<unknown>) => void; targets: Set<Element>}> = []
beforeAll(() => {
  globalThis.ResizeObserver = class {
    private o: {cb: (entries: Array<unknown>) => void; targets: Set<Element>}
    constructor(cb: (entries: Array<unknown>) => void) {
      this.o = {cb, targets: new Set()}
      observers.push(this.o)
    }
    observe(target: Element) {
      this.o.targets.add(target)
    }
    unobserve(target: Element) {
      this.o.targets.delete(target)
    }
    disconnect() {
      this.o.targets.clear()
    }
  } as unknown as typeof ResizeObserver
})
// with a size, as the browser reports a box it measured
const resized = (target: Element, size?: {width: number; height: number}) => {
  const entries = size ? [{borderBoxSize: [{blockSize: size.height, inlineSize: size.width}], target}] : []
  act(() => {
    observers.filter(o => o.targets.has(target)).forEach(o => o.cb(entries))
  })
}

const anchors: Array<HTMLElement> = []
const anchorElement = () => {
  const element = document.createElement('div')
  document.body.appendChild(element)
  anchors.push(element)
  return element
}

const refTo = (element: HTMLElement | null): React.RefObject<MeasureRef | null> => ({current: element})
const noop = () => {}
const popups = overlayEntries
const anchorNameOf = (element: HTMLElement) => element.style.getPropertyValue('anchor-name')

// a click: a press and release that do not move
const click = (target: Element, x = 10, y = 10) => {
  fireEvent.mouseDown(target, {clientX: x, clientY: y})
  return fireEvent.mouseUp(target, {clientX: x, clientY: y})
}

describe('RelativeFloatingBox', () => {
  beforeEach(() => {
    observers = []
  })
  afterEach(() => {
    anchors.splice(0).forEach(a => a.remove())
  })

  test('shows a manual popover anchored to the attachTo element', () => {
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={noop} position="bottom left">
        <Box2 direction="vertical">content</Box2>
      </RelativeFloatingBox>
    )
    const [popup] = popups()
    expect(popup?.getAttribute('popover')).toBe('manual')
    expect(overlay.shown).toEqual([popup])
    expect(popup?.hasAttribute('data-unanchored')).toBe(false)
    expect(anchorNameOf(anchor)).toMatch(/^--kb-anchor-\w+$/)
  })

  test('removes its anchor name on unmount, leaving any other popup anchored there', () => {
    const anchor = anchorElement()
    anchor.style.setProperty('anchor-name', '--other')
    const {unmount} = render(
      <RelativeFloatingBox attachTo={refTo(anchor)} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(anchorNameOf(anchor)).toMatch(/^--other, --kb-anchor-\w+$/)
    unmount()
    expect(anchorNameOf(anchor)).toBe('--other')
    expect(overlay.shown).toEqual([])
  })

  test('moves its anchor name when attachTo points somewhere else', () => {
    const first = anchorElement()
    const second = anchorElement()
    const attachTo = refTo(first)
    const {rerender} = render(
      <RelativeFloatingBox attachTo={attachTo} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    const name = anchorNameOf(first)
    attachTo.current = second
    rerender(
      <RelativeFloatingBox attachTo={attachTo} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(anchorNameOf(first)).toBe('')
    expect(anchorNameOf(second)).toBe(name)
  })

  // a popup sizes to its content, so long text with no width set would grow to the window's width
  test('is no wider than the window less the gap kept at its edges, so long text wraps', () => {
    render(
      <RelativeFloatingBox attachTo={refTo(anchorElement())} offset={4} position="bottom left">
        a long line of text
      </RelativeFloatingBox>
    )
    const [popup] = popups()
    expect(popup?.style.maxWidth).toBe('calc(100% - 4 * var(--kb-popup-offset, 0px))')
    expect(popup?.style.getPropertyValue('--kb-popup-offset')).toBe('4px')
  })

  test('stays hidden with nothing to anchor to', () => {
    render(
      <RelativeFloatingBox attachTo={refTo(null)} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(popups()[0]?.hasAttribute('data-unanchored')).toBe(true)
  })

  // problem 7: the chat suggestion list renders before the input it anchors to
  test('a popup rendered before its anchor ends up anchored to it', () => {
    const App = () => {
      const anchor = React.useRef<HTMLDivElement>(null)
      return (
        <>
          <RelativeFloatingBox attachTo={anchor} position="top left">
            suggestions
          </RelativeFloatingBox>
          <div ref={anchor}>input</div>
        </>
      )
    }
    render(<App />)
    expect(popups()[0]?.hasAttribute('data-unanchored')).toBe(false)
    expect(anchorNameOf(screen.getByText('input'))).toMatch(/^--kb-anchor-\w+$/)
  })

  // problem 8: a list row re-renders its own anchor element while the popup stays as it is
  describe('when its anchor is replaced or removed without it re-rendering', () => {
    test('follows the new anchor', () => {
      const first = anchorElement()
      const attachTo = refTo(first)
      render(
        <RelativeFloatingBox attachTo={attachTo} position="bottom left">
          content
        </RelativeFloatingBox>
      )
      const name = anchorNameOf(first)
      const second = anchorElement()
      first.remove()
      attachTo.current = second
      resized(first)
      expect(anchorNameOf(second)).toBe(name)
      expect(popups()[0]?.hasAttribute('data-unanchored')).toBe(false)
    })

    test('hides while there is none, and shows again on its anchor once there is', () => {
      const first = anchorElement()
      const attachTo = refTo(first)
      render(
        <RelativeFloatingBox attachTo={attachTo} position="bottom left">
          content
        </RelativeFloatingBox>
      )
      first.remove()
      resized(first)
      const [popup] = popups()
      expect(popup?.hasAttribute('data-unanchored')).toBe(true)
      // still open
      expect(overlay.shown).toEqual([popup])

      // re-checked whenever the stack changes, e.g. a tooltip opening
      const second = anchorElement()
      attachTo.current = second
      render(
        <RelativeFloatingBox attachTo={refTo(anchorElement())} position="top left">
          tooltip
        </RelativeFloatingBox>
      )
      expect(popup?.hasAttribute('data-unanchored')).toBe(false)
      expect(anchorNameOf(second)).toMatch(/^--kb-anchor-\w+$/)
    })
  })

  test('while it has no anchor, keys and clicks go to what is under it', () => {
    const under = jest.fn()
    const onHidden = jest.fn()
    const first = anchorElement()
    const attachTo = refTo(first)
    render(
      <EscapeHandler onESC={under}>
        <RelativeFloatingBox attachTo={attachTo} onHidden={onHidden} position="bottom left">
          menu
        </RelativeFloatingBox>
      </EscapeHandler>
    )
    first.remove()
    resized(first)
    fireEvent.keyDown(document.body, {key: 'Escape'})
    click(document.body)
    expect(under).toHaveBeenCalledTimes(1)
    expect(onHidden).not.toHaveBeenCalled()

    // anchored again once the stack next changes, e.g. a tooltip opening
    attachTo.current = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchorElement())} position="top left">
        tooltip
      </RelativeFloatingBox>
    )
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(under).toHaveBeenCalledTimes(1)
  })

  // Placed before its size is known, a menu near the window's corner lands on its pushed fallback,
  // over its own anchor; the row lost its hover, the toolbar anchor hid, and the menu was held there.
  test('is not drawn, and holds no place, until what is inside is there to measure', async () => {
    const Menu = () => <>menu</>
    let load: () => void = () => {}
    const loaded = new Promise<{default: React.ComponentType}>(resolve => {
      load = () => resolve({default: Menu})
    })
    const Lazy = React.lazy(async () => loaded)
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={noop} position="top right">
        <Lazy />
      </RelativeFloatingBox>
    )
    const [popup] = popups()
    if (!popup) {
      throw new Error('no popup')
    }
    // where the browser places it: off without its size, right with it
    popup.getBoundingClientRect = () =>
      (popup.style.getPropertyValue('--kb-popup-width')
        ? {height: 382, left: 920, top: 442, width: 256}
        : {height: 382, left: 952, top: 541, width: 256}) as DOMRect
    expect(popup.hasAttribute('data-unsized')).toBe(true)
    anchor.style.display = 'none'
    resized(anchor)
    expect(popup.hasAttribute('data-held')).toBe(false)
    anchor.style.display = ''
    resized(anchor)

    await act(async () => {
      load()
      await loaded
    })
    expect(popup.hasAttribute('data-unsized')).toBe(false)
    expect(popup.style.getPropertyValue('--kb-popup-width')).toBe('256px')
    expect(popup.style.getPropertyValue('--kb-popup-height')).toBe('382px')
    anchor.style.display = 'none'
    resized(anchor)
    expect(popup.hasAttribute('data-held')).toBe(true)
    expect(popup.style.getPropertyValue('--kb-popup-held-left')).toBe('920px')
    expect(popup.style.getPropertyValue('--kb-popup-held-top')).toBe('442px')
  })

  // The composer's emoji picker focuses its search field as it mounts, and once more 20ms later
  // (SearchFilter). The size observer may not have reported by either time.
  const SelfFocusingSearch = () => {
    const ref = React.useRef<HTMLInputElement>(null)
    React.useEffect(() => {
      ref.current?.focus()
      const id = setTimeout(() => ref.current?.focus(), 20)
      return () => clearTimeout(id)
    }, [])
    return <input aria-label="search" ref={ref} />
  }
  const PickerApp = (p: {open: 'none' | 'auto' | 'effect'}) =>
    p.open === 'none' ? null : (
      <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="top right">
        {p.open === 'auto' ? <input aria-label="search" autoFocus={true} /> : <SelfFocusingSearch />}
      </RelativeFloatingBox>
    )

  describe('what is inside', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    test('can take focus as it mounts', () => {
      const {rerender} = render(<PickerApp open="auto" />)
      expect(document.activeElement).toBe(screen.getByLabelText('search'))
      rerender(<PickerApp open="none" />)
      rerender(<PickerApp open="effect" />)
      act(() => {
        jest.advanceTimersByTime(20)
      })
      expect(document.activeElement).toBe(screen.getByLabelText('search'))
    })
  })

  // a message menu opened from the hover toolbar, which hides once the pointer leaves the row
  test('while its anchor is there but not rendered, it stays where it was, visible and usable', () => {
    const under = jest.fn()
    const onHidden = jest.fn()
    const anchor = anchorElement()
    render(
      <EscapeHandler onESC={under}>
        <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={onHidden} position="bottom left">
          menu
        </RelativeFloatingBox>
      </EscapeHandler>
    )
    const [popup] = popups()
    if (!popup) {
      throw new Error('no popup')
    }
    // where the browser placed it on its anchor
    popup.getBoundingClientRect = () => ({left: 40, top: 60, width: 120}) as DOMRect
    resized(popup, {height: 80, width: 120})

    anchor.style.display = 'none'
    resized(anchor)
    expect(popup.hasAttribute('data-held')).toBe(true)
    expect(popup.hasAttribute('data-unanchored')).toBe(false)
    expect(popup.style.getPropertyValue('--kb-popup-held-left')).toBe('40px')
    expect(popup.style.getPropertyValue('--kb-popup-held-top')).toBe('60px')
    expect(popup.style.getPropertyValue('--kb-popup-held-width')).toBe('120px')
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(under).not.toHaveBeenCalled()

    // back on its anchor once it is rendered again
    anchor.style.display = ''
    resized(anchor)
    expect(popup.hasAttribute('data-held')).toBe(false)
    expect(popup.hasAttribute('data-unanchored')).toBe(false)
  })

  test('a popup inside another is shown after it, so it stacks above it', () => {
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} position="bottom left">
        <RelativeFloatingBox attachTo={refTo(anchor)} position="top left">
          inner
        </RelativeFloatingBox>
      </RelativeFloatingBox>
    )
    const [outer, inner] = popups()
    expect(inner?.textContent).toBe('inner')
    expect(overlay.shown).toEqual([outer, inner])
  })

  test('a popup opened inside a modal is shown after it, so it stacks above it', () => {
    const anchor = anchorElement()
    render(
      <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
        <RelativeFloatingBox attachTo={refTo(anchor)} position="bottom left">
          content
        </RelativeFloatingBox>
      </OverlayEntry>
    )
    const [modal, popup] = popups()
    expect(popup?.textContent).toBe('content')
    expect(overlay.shown).toEqual([modal, popup])
  })

  // problem 5: a modal mounted in the same commit as the popup it is in was shown before it
  test('a modal opened inside a popup is shown after it and covers it', () => {
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={noop} position="bottom left">
        <ModalCover>dialog</ModalCover>
      </RelativeFloatingBox>
    )
    const [popup, modal] = popups()
    expect(modal?.textContent).toBe('dialog')
    expect(overlay.shown).toEqual([popup, modal])
    expect(popup?.hasAttribute('data-hidden')).toBe(true)
    expect(popup?.hasAttribute('inert')).toBe(true)
  })

  // a menu or tooltip in a modal another modal opened over
  test('a popup in a covered modal is hidden until the modal is uncovered', () => {
    const Stack = (p: {second: boolean}) => (
      <>
        <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
          <RelativeFloatingBox attachTo={refTo(anchorElement())} position="bottom left">
            tooltip
          </RelativeFloatingBox>
        </OverlayEntry>
        {p.second ? (
          <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
            second
          </OverlayEntry>
        ) : null}
      </>
    )
    const {rerender} = render(<Stack second={false} />)
    const tooltip = popups()[1]
    expect(tooltip?.hasAttribute('data-hidden')).toBe(false)
    rerender(<Stack second={true} />)
    expect(tooltip?.hasAttribute('data-hidden')).toBe(true)
    rerender(<Stack second={false} />)
    expect(tooltip?.hasAttribute('data-hidden')).toBe(false)
  })

  describe('closing on outside clicks', () => {
    const setup = (propagate?: boolean) => {
      const onHidden = jest.fn()
      const anchor = anchorElement()
      render(
        <RelativeFloatingBox
          attachTo={refTo(anchor)}
          onHidden={onHidden}
          position="bottom left"
          propagateOutsideClicks={propagate}
        >
          <Box2 direction="vertical">content</Box2>
        </RelativeFloatingBox>
      )
      return {anchor, content: screen.getByText('content'), onHidden}
    }

    test('a click outside closes it, and stops there', () => {
      const {anchor, onHidden} = setup()
      const reached = jest.fn()
      anchor.addEventListener('mouseup', reached)
      fireEvent.mouseDown(anchor, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(anchor, {clientX: 12, clientY: 12})
      expect(onHidden).toHaveBeenCalledTimes(1)
      expect(reached).not.toHaveBeenCalled()
    })

    test('with propagateOutsideClicks the click goes on to what was clicked', () => {
      const {anchor, onHidden} = setup(true)
      const reached = jest.fn()
      anchor.addEventListener('mouseup', reached)
      click(anchor)
      expect(onHidden).toHaveBeenCalledTimes(1)
      expect(reached).toHaveBeenCalledTimes(1)
    })

    test('a drag that ends outside, like selecting text in it, does not', () => {
      const {content, onHidden} = setup()
      fireEvent.mouseDown(content, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(document.body, {clientX: 60, clientY: 10})
      expect(onHidden).not.toHaveBeenCalled()
    })

    test('a drag that starts outside does not', () => {
      const {anchor, onHidden} = setup()
      fireEvent.mouseDown(anchor, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(anchor, {clientX: 60, clientY: 10})
      expect(onHidden).not.toHaveBeenCalled()
    })

    test('a click inside does not', () => {
      const {content, onHidden} = setup()
      click(content)
      expect(onHidden).not.toHaveBeenCalled()
    })
  })

  // a popup opened from a menu, like a hover card, is a DOM sibling of the menu in #modal-root
  test('a click in a popup opened from a menu is inside the menu', () => {
    const menu = jest.fn()
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={menu} position="bottom left">
        menu
        <FloatingBox attachTo={refTo(anchor)}>card</FloatingBox>
      </RelativeFloatingBox>
    )
    click(screen.getByText('card'))
    expect(menu).not.toHaveBeenCalled()
  })

  test('one entry per click: a click outside closes only the topmost popup', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={outer} position="bottom left">
        menu
        <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={inner} position="top left">
          submenu
        </RelativeFloatingBox>
      </RelativeFloatingBox>
    )
    click(anchor)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    // the menu itself is inside the menu, but outside the submenu
    click(screen.getByText('menu'))
    expect(inner).toHaveBeenCalledTimes(2)
    expect(outer).not.toHaveBeenCalled()
  })

  describe('a tooltip opening re-shows nothing', () => {
    const tooltip = (show: boolean) =>
      show ? (
        <FloatingBox attachTo={refTo(anchorElement())} position="top center">
          tooltip
        </FloatingBox>
      ) : null

    test('in a modal while the banner is up', () => {
      const App = (p: {tip: boolean}) => (
        <>
          <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
            modal{tooltip(p.tip)}
          </OverlayEntry>
          <GlobalOverlay tier="globalError">
            <input aria-label="field" />
          </GlobalOverlay>
        </>
      )
      const {rerender} = render(<App tip={false} />)
      const field = screen.getByLabelText('field')
      field.focus()
      const [modal, banner] = popups()
      const refocused = jest.fn()
      field.addEventListener('focus', refocused)
      const showPopover = jest.spyOn(HTMLElement.prototype, 'showPopover')
      try {
        rerender(<App tip={true} />)
        const tip = popups().find(e => e.textContent === 'tooltip')
        expect(showPopover.mock.contexts).toEqual([tip])
        expect(overlay.shown).toEqual([modal, banner, tip])
        expect(refocused).not.toHaveBeenCalled()
        expect(document.activeElement).toBe(field)
      } finally {
        showPopover.mockRestore()
      }
    })

    test('in a popup while a later popup is open', () => {
      const App = (p: {tip: boolean}) => (
        <>
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            first{tooltip(p.tip)}
          </RelativeFloatingBox>
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            second
          </RelativeFloatingBox>
        </>
      )
      const {rerender} = render(<App tip={false} />)
      const [first, second] = popups()
      rerender(<App tip={true} />)
      const tip = popups().find(e => e.textContent === 'tooltip')
      expect(overlay.shown).toEqual([first, second, tip])
      expect(second?.hasAttribute('data-reshown')).toBe(false)
    })
  })

  test('a popup re-shown above an insert under it does not fade in again', () => {
    const App = (p: {modal: boolean}) => (
      <>
        {p.modal ? (
          <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
            modal
          </OverlayEntry>
        ) : null}
        <GlobalOverlay tier="globalError">
          banner
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            menu
          </RelativeFloatingBox>
        </GlobalOverlay>
      </>
    )
    const {rerender} = render(<App modal={false} />)
    const menu = popups().find(e => e.textContent === 'menu')
    expect(menu?.hasAttribute('data-reshown')).toBe(false)
    rerender(<App modal={true} />)
    const modal = popups().find(e => e.textContent === 'modal')
    expect(overlay.shown.indexOf(modal!)).toBeLessThan(overlay.shown.indexOf(menu!))
    expect(menu?.hasAttribute('data-reshown')).toBe(true)
    expect(modal?.hasAttribute('data-reshown')).toBe(false)
  })

  test('a tooltip neither closes on outside clicks nor keeps them from what is under it', () => {
    const onHidden = jest.fn()
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onHidden={onHidden} position="bottom left">
        menu
        <FloatingBox attachTo={refTo(anchor)}>tooltip</FloatingBox>
      </RelativeFloatingBox>
    )
    click(anchor)
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  test('a click outside a popup in a modal closes the popup, not the modal', () => {
    const onModal = jest.fn()
    const onPopup = jest.fn()
    const content = {current: null as HTMLDivElement | null}
    const setContent = (el: HTMLDivElement | null) => {
      content.current = el
    }
    render(
      <OverlayEntry
        acceptsKeys={true}
        blocking={true}
        kind="modal"
        outside={{content: () => content.current, onOutside: onModal, propagate: true}}
        stoppedEscapeCloses={true}
      >
        <div ref={setContent}>
          modal
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={onPopup} position="bottom left">
            menu
          </RelativeFloatingBox>
        </div>
      </OverlayEntry>
    )
    click(screen.getByText('modal'))
    expect(onPopup).toHaveBeenCalledTimes(1)
    expect(onModal).not.toHaveBeenCalled()
  })

  test('a popup with no onHidden leaves escape to what is under it', () => {
    const under = jest.fn()
    const onHidden = jest.fn()
    const Screen = (p: {popup?: React.ReactNode}) => <EscapeHandler onESC={under}>{p.popup}</EscapeHandler>
    const {rerender} = render(<Screen />)
    rerender(<Screen popup={<FloatingBox attachTo={refTo(anchorElement())}>tooltip</FloatingBox>} />)
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(under).toHaveBeenCalledTimes(1)

    rerender(<Screen />)
    rerender(
      <Screen
        popup={
          <FloatingBox attachTo={refTo(anchorElement())} onHidden={onHidden}>
            menu
          </FloatingBox>
        }
      />
    )
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(under).toHaveBeenCalledTimes(1)
  })

  // Q4: focus would otherwise fall to the document
  test('closing with focus inside puts focus back on what opened it', () => {
    const App = (p: {open: boolean}) => (
      <>
        <button>open menu</button>
        {p.open ? (
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            <input aria-label="filter" />
          </RelativeFloatingBox>
        ) : null}
      </>
    )
    const {rerender} = render(<App open={false} />)
    const opener = screen.getByText('open menu')
    opener.focus()
    rerender(<App open={true} />)
    screen.getByLabelText('filter').focus()
    rerender(<App open={false} />)
    expect(document.activeElement).toBe(opener)
  })

  // the emoji picker's search field blurs itself on Escape, and then the picker closes
  test('closing after a field in it let go of focus still puts focus back on what opened it', () => {
    const App = (p: {open: boolean}) => (
      <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
        <button>choose emoji</button>
        {p.open ? (
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            <input aria-label="search" />
          </RelativeFloatingBox>
        ) : null}
      </OverlayEntry>
    )
    const {rerender} = render(<App open={false} />)
    const opener = screen.getByText('choose emoji')
    opener.focus()
    rerender(<App open={true} />)
    const search = screen.getByLabelText('search')
    search.focus()
    search.blur()
    expect(document.activeElement).toBe(document.body)
    rerender(<App open={false} />)
    expect(document.activeElement).toBe(opener)
  })

  test('opening does not move focus', () => {
    const App = (p: {open: boolean}) => (
      <>
        <input aria-label="field" />
        {p.open ? (
          <RelativeFloatingBox attachTo={refTo(anchorElement())} onHidden={noop} position="bottom left">
            menu
          </RelativeFloatingBox>
        ) : null}
      </>
    )
    const {rerender} = render(<App open={false} />)
    const field = screen.getByLabelText('field')
    field.focus()
    rerender(<App open={true} />)
    expect(document.activeElement).toBe(field)
  })

  test('renders nothing when there is no modal root', () => {
    document.getElementById('modal-root')?.remove()
    const {container} = render(
      <RelativeFloatingBox attachTo={refTo(anchorElement())} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(container.innerHTML).toBe('')
    expect(overlay.shown).toEqual([])
  })
})
