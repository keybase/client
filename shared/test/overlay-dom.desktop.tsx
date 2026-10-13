/// <reference types="jest" />
import type * as React from 'react'
import {cleanup} from '@testing-library/react'
import {KeyEventHandler} from '@/common-adapters/key-event-handler.desktop'

// Desktop overlays are manual popovers portaled into #modal-root, and the app root goes inert under a
// modal. jsdom has neither root nor the Popover API, so tests that render overlays call this once:
// it adds both roots around every test and records what is shown, in top-layer order.
export const setupOverlayDom = () => {
  const state = {
    hide: (element: HTMLElement) => {
      state.shown = state.shown.filter(p => p !== element)
    },
    shown: [] as Array<HTMLElement>,
  }
  beforeAll(() => {
    HTMLElement.prototype.showPopover = function (this: HTMLElement) {
      if (state.shown.includes(this)) {
        throw new Error('already shown')
      }
      state.shown.push(this)
    }
    HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
      state.hide(this)
    }
    // jsdom has no checkVisibility: an element is rendered unless it or an ancestor is display:none
    const displayed = (e: Element | null): boolean =>
      !e || (getComputedStyle(e).display !== 'none' && displayed(e.parentElement))
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return displayed(this)
    }
    // as in a browser, nothing in a popover that is not shown, or in an inert subtree, can take focus
    const {focus} = Object.getOwnPropertyDescriptors(HTMLElement.prototype)
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      const popover = this.closest<HTMLElement>('[popover]')
      if ((popover && !state.shown.includes(popover)) || this.closest('[inert]')) {
        return
      }
      ;(focus.value as HTMLElement['focus']).call(this, options)
    }
  })
  beforeEach(() => {
    state.shown = []
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
  return state
}

export const overlayEntries = () => [
  ...document.querySelectorAll<HTMLElement>('#modal-root > [data-overlay-entry]'),
]

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
