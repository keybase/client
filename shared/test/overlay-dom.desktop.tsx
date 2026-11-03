/// <reference types="jest" />
import type * as React from 'react'
import {cleanup} from '@testing-library/react'
import {useNavigation, type ParamListBase, type RouteProp} from '@react-navigation/core'
import {KeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {ModalWrapper, type ModalWrapperProps} from '@/router-v2/screen-layout-modal.desktop'
import {installNavigation, makeRootState, type InstalledNavigation} from './navigation'

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

// ModalWrapper as the app mounts it: inside a modal route of the real navigation tree, with that
// route's own navigation, so pop, beforeRemove (only for the routes a pop removes) and the transition
// the new state renders in are the library's.
export const RouteModal = (p: Omit<ModalWrapperProps, 'navigation' | 'canGoBack'>) => {
  const {children, navigationOptions} = p
  // a route's navigation, typed as the native stack's that ModalWrapper is written against
  const navigation = useNavigation() as unknown as ModalWrapperProps['navigation']
  return (
    <ModalWrapper canGoBack={navigation.canGoBack()} navigation={navigation} navigationOptions={navigationOptions}>
      {children}
    </ModalWrapper>
  )
}

// The real tree with modal routes over the chat tab. Each route renders what its entry returns, and
// `under` renders the chat tab's root. `open` names the routes open at the start, bottom to top: all
// of them unless given.
export const showModals = (
  modals: ReadonlyArray<{name: string; render: (route: RouteProp<ParamListBase>) => React.ReactNode}>,
  p?: {open?: ReadonlyArray<string>; under?: () => React.ReactNode}
): InstalledNavigation =>
  installNavigation({
    rootState: makeRootState({above: (p?.open ?? modals.map(m => m.name)).map(name => ({name}))}),
    screen: (route): React.ReactNode =>
      route.name === 'chatRoot' ? p?.under?.() : modals.find(m => m.name === route.name)?.render(route),
  })
