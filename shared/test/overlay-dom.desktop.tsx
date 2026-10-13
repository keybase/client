/// <reference types="jest" />
import type * as React from 'react'
import {cleanup} from '@testing-library/react'
import {KeyEventHandler} from '@/common-adapters/key-event-handler.desktop'

// Desktop overlays are portaled into #modal-root, and the app root goes inert under a modal. jsdom has
// no such roots, so tests that render overlays call this once: it adds both around every test.
export const setupOverlayDom = () => {
  beforeAll(() => {
    // jsdom has no checkVisibility: an element is rendered unless it or an ancestor is display:none
    const displayed = (e: Element | null): boolean =>
      !e || (getComputedStyle(e).display !== 'none' && displayed(e.parentElement))
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return displayed(this)
    }
    // as in a browser, nothing in an inert subtree, or in a popup not measured yet (visibility:hidden in
    // style.css), can take focus
    const {focus} = Object.getOwnPropertyDescriptors(HTMLElement.prototype)
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (this.closest('[inert], [data-unsized]')) {
        return
      }
      ;(focus.value as HTMLElement['focus']).call(this, options)
    }
  })
  beforeEach(() => {
    const root = document.createElement('div')
    root.id = 'root'
    const modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.append(root, modalRoot)
  })
  afterEach(() => {
    cleanup()
    document.getElementById('root')?.remove()
    document.getElementById('modal-root')?.remove()
  })
}

export const overlayEntries = () => [
  ...document.querySelectorAll<HTMLElement>('#modal-root > [data-overlay-entry]'),
]

// the entries, bottom to top, as they are drawn
export const paintOrder = () =>
  overlayEntries().sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex))

// a key handler that takes Escape and nothing else, like an open menu
export const EscapeHandler = (p: {onESC: () => void; children?: React.ReactNode}) => {
  const {children, onESC} = p
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') {
      return false
    }
    onESC()
    return true
  }
  return <KeyEventHandler onKeyDown={onKeyDown}>{children}</KeyEventHandler>
}

// A modal route's navigation as ModalWrapper uses it. Like react-navigation, pop announces the
// route's removal (beforeRemove) at once, while the new state renders later, in a transition: here
// the modal stays rendered until the test unmounts it.
export const fakeModalNavigation = (onPop: () => void = () => {}) => {
  const listeners = new Set<(e: {defaultPrevented: boolean}) => void>()
  return {
    addListener: (_event: 'beforeRemove', listener: (e: {defaultPrevented: boolean}) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    pop: () => {
      listeners.forEach(listener => listener({defaultPrevented: false}))
      onPop()
    },
  } as never
}
