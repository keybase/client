/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {Box2} from '../../box'
import type {MeasureRef} from '../../measure-ref'
import {EscapeHandler} from '../../key-event-handler.desktop'
import {OverlayEntry} from '../../overlay/entry.desktop'
import FloatingBox from './index.desktop'
import {RelativeFloatingBox} from './relative-floating-box.desktop'

// jsdom has neither the Popover API nor ResizeObserver
let shown: Array<HTMLElement> = []
beforeAll(() => {
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    shown.push(this)
  }
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    shown = shown.filter(p => p !== this)
  }
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
})

const anchorElement = () => {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return element
}

const refTo = (element: HTMLElement | null): React.RefObject<MeasureRef | null> => ({current: element})

const popups = () => [...document.querySelectorAll<HTMLElement>('#modal-root > [popover]')]

describe('RelativeFloatingBox', () => {
  beforeEach(() => {
    shown = []
    const modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.appendChild(modalRoot)
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  test('shows a manual popover anchored to the attachTo element', () => {
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={() => {}} position="bottom left">
        <Box2 direction="vertical">content</Box2>
      </RelativeFloatingBox>
    )
    const [popup] = popups()
    expect(popup?.getAttribute('popover')).toBe('manual')
    expect(shown).toEqual([popup])
    expect(popup?.hasAttribute('data-unanchored')).toBe(false)
    expect(anchor.style.getPropertyValue('anchor-name')).toMatch(/^--kb-anchor-\w+$/)
  })

  test('removes its anchor name on unmount, leaving any other popup anchored there', () => {
    const anchor = anchorElement()
    anchor.style.setProperty('anchor-name', '--other')
    const {unmount} = render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={() => {}} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(anchor.style.getPropertyValue('anchor-name')).toMatch(/^--other, --kb-anchor-\w+$/)
    unmount()
    expect(anchor.style.getPropertyValue('anchor-name')).toBe('--other')
    expect(shown).toEqual([])
  })

  test('moves its anchor name when attachTo points somewhere else', () => {
    const first = anchorElement()
    const second = anchorElement()
    const attachTo = refTo(first)
    const {rerender} = render(
      <RelativeFloatingBox attachTo={attachTo} onClosePopup={() => {}} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    const name = first.style.getPropertyValue('anchor-name')
    attachTo.current = second
    rerender(
      <RelativeFloatingBox attachTo={attachTo} onClosePopup={() => {}} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(first.style.getPropertyValue('anchor-name')).toBe('')
    expect(second.style.getPropertyValue('anchor-name')).toBe(name)
  })

  test('stays hidden with nothing to anchor to', () => {
    render(
      <RelativeFloatingBox attachTo={refTo(null)} onClosePopup={() => {}} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(popups()[0]?.hasAttribute('data-unanchored')).toBe(true)
  })

  test('a popup inside another is shown after it, so it stacks above it', () => {
    const anchor = anchorElement()
    render(
      <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={() => {}} position="bottom left">
        <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={() => {}} position="top left">
          inner
        </RelativeFloatingBox>
      </RelativeFloatingBox>
    )
    // the inner popup is portaled out of the outer one, so the outer one holds no text of its own
    const outer = popups().find(p => p.textContent === '')
    const inner = popups().find(p => p.textContent === 'inner')
    expect(outer).toBeDefined()
    expect(shown).toEqual([outer, inner])
  })

  describe('closing on outside clicks', () => {
    const setup = () => {
      const onClosePopup = jest.fn()
      const anchor = anchorElement()
      render(
        <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={onClosePopup} position="bottom left">
          <Box2 direction="vertical">content</Box2>
        </RelativeFloatingBox>
      )
      return {anchor, content: popups()[0]?.firstElementChild as HTMLElement, onClosePopup}
    }

    test('a click outside closes it', () => {
      const {anchor, onClosePopup} = setup()
      fireEvent.mouseDown(anchor, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(anchor, {clientX: 12, clientY: 12})
      expect(onClosePopup).toHaveBeenCalledTimes(1)
    })

    test('a drag that ends outside, like selecting text in it, does not', () => {
      const {content, onClosePopup} = setup()
      fireEvent.mouseDown(content, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(document.body, {clientX: 60, clientY: 10})
      expect(onClosePopup).not.toHaveBeenCalled()
    })

    test('a click inside does not', () => {
      const {content, onClosePopup} = setup()
      fireEvent.mouseDown(content, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(content, {clientX: 10, clientY: 10})
      expect(onClosePopup).not.toHaveBeenCalled()
    })
  })

  test('a popup opened inside a modal is shown after it, so it stacks above it', () => {
    const anchor = anchorElement()
    render(
      <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" stoppedEscapeCloses={true}>
        <RelativeFloatingBox attachTo={refTo(anchor)} onClosePopup={() => {}} position="bottom left">
          content
        </RelativeFloatingBox>
      </OverlayEntry>
    )
    const [modal, popup] = popups()
    expect(modal?.hasAttribute('data-overlay-entry')).toBe(true)
    expect(popup?.textContent).toBe('content')
    expect(shown).toEqual([modal, popup])
  })

  test('a popup with no onHidden leaves escape to what is under it', () => {
    const under = jest.fn()
    const onHidden = jest.fn()
    const Screen = (p: {popup?: React.ReactNode}) => (
      <>
        <EscapeHandler onESC={under}>{p.popup}</EscapeHandler>
      </>
    )
    const {rerender} = render(<Screen />)
    // mounted after, so on top of the stack
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

  test('renders nothing when there is no modal root', () => {
    document.getElementById('modal-root')?.remove()
    const {container} = render(
      <RelativeFloatingBox attachTo={refTo(anchorElement())} onClosePopup={() => {}} position="bottom left">
        content
      </RelativeFloatingBox>
    )
    expect(container.innerHTML).toBe('')
    expect(shown).toEqual([])
  })
})
