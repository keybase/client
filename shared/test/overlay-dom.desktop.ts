/// <reference types="jest" />
import {cleanup} from '@testing-library/react'

// Desktop overlays are manual popovers portaled into #modal-root, and the app root goes inert under a
// modal. jsdom has neither root nor the Popover API, so tests that render overlays call this once:
// it adds both roots around every test and records what is shown, in top-layer order.
export const setupOverlayDom = () => {
  const state = {shown: [] as Array<HTMLElement>}
  beforeAll(() => {
    HTMLElement.prototype.showPopover = function (this: HTMLElement) {
      if (state.shown.includes(this)) {
        throw new Error('already shown')
      }
      state.shown.push(this)
    }
    HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
      state.shown = state.shown.filter(p => p !== this)
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
