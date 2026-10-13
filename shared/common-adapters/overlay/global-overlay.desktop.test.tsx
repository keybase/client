/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {ModalCover} from '../popup/modal-cover.desktop'
import {OverlayEntry} from './entry.desktop'
import {GlobalOverlay} from './global-overlay.desktop'
import {EscapeHandler, overlayEntries, paintOrder, setupOverlayDom} from '@/test/overlay-dom.desktop'

jest.mock('@/constants', () => ({
  Router2: {
    useSafeFocusEffect: (cb: () => (() => void) | undefined) => jest.requireActual<typeof React>('react').useEffect(cb, [cb]),
  },
}))
jest.mock('@/constants/platform', () => ({isMac: true}))

import {useHotKey} from '../hot-key'

setupOverlayDom()

const RouterModal = (p: {children?: React.ReactNode; onEscape?: () => void}) => (
  <OverlayEntry acceptsKeys={true} blocking={true} kind="modal" onEscape={p.onEscape}>
    {p.children}
  </OverlayEntry>
)

// as login/reset/modal renders it
const ResetCover = () => (
  <GlobalOverlay tier="accountReset">
    <ModalCover>reset</ModalCover>
  </GlobalOverlay>
)

const Banner = (p: {onMount: () => void}) => {
  const {onMount} = p
  React.useEffect(() => {
    onMount()
  }, [onMount])
  return <button>banner</button>
}

const HotKey = (p: {keys: string; cb: () => void}) => {
  useHotKey(p.keys, p.cb)
  return null
}

const entryHolding = (text: string) =>
  overlayEntries().find(e => e.textContent === text) ?? (undefined as HTMLElement | undefined)

const pressEscape = () => {
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'}))
  })
}

describe('GlobalOverlay', () => {
  test('a router modal opened while the reset cover is up goes under it and gets nothing', () => {
    const onEscape = jest.fn()
    const newChat = jest.fn()
    const App = (p: {modal: boolean}) => (
      <>
        <HotKey keys="mod+n" cb={newChat} />
        <ResetCover />
        {p.modal ? <RouterModal onEscape={onEscape}>feedback</RouterModal> : null}
      </>
    )
    const {rerender} = render(<App modal={false} />)
    rerender(<App modal={true} />)
    const feedback = entryHolding('feedback')
    const cover = entryHolding('reset')
    expect(paintOrder().indexOf(feedback!)).toBeLessThan(paintOrder().indexOf(cover!))
    expect(feedback?.hasAttribute('inert')).toBe(true)
    // still drawn under the cover
    expect(feedback?.hasAttribute('data-hidden')).toBe(false)
    expect(cover?.hasAttribute('inert')).toBe(false)

    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'n', metaKey: true}))
    })
    expect(newChat).not.toHaveBeenCalled()
  })

  // the banner is its own entry: its DOM, context and state stay its own
  test('the error banner stays above modals, usable, and keeps its state as they open and close', () => {
    const onMount = jest.fn()
    const onClick = jest.fn()
    const App = (p: {modal: boolean}) => (
      <>
        {p.modal ? <RouterModal>modal</RouterModal> : null}
        <GlobalOverlay tier="globalError">
          <Banner onMount={onMount} />
        </GlobalOverlay>
      </>
    )
    const {rerender} = render(<App modal={false} />)
    const banner = entryHolding('banner')
    screen.getByText('banner').addEventListener('click', onClick)
    rerender(<App modal={true} />)
    const modal = entryHolding('modal')
    expect(paintOrder()).toEqual([modal, banner])
    expect(banner?.hasAttribute('inert')).toBe(false)
    expect(banner?.classList.contains('overlay-entry-passthrough')).toBe(true)
    fireEvent.click(screen.getByText('banner'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<App modal={false} />)
    expect(onMount).toHaveBeenCalledTimes(1)
  })

  test('a click on the banner does not close the modal under it', () => {
    const onOutside = jest.fn()
    const content = {current: null as HTMLDivElement | null}
    const setContent = (el: HTMLDivElement | null) => {
      content.current = el
    }
    render(
      <>
        <OverlayEntry
          acceptsKeys={true}
          blocking={true}
          kind="modal"
          outside={{content: () => content.current, onOutside, propagate: true}}
        >
          <div ref={setContent}>modal</div>
        </OverlayEntry>
        <GlobalOverlay tier="globalError">
          <button>banner</button>
        </GlobalOverlay>
      </>
    )
    const click = (target: Element) => {
      fireEvent.mouseDown(target, {clientX: 10, clientY: 10})
      fireEvent.mouseUp(target, {clientX: 10, clientY: 10})
    }
    click(screen.getByText('banner'))
    expect(onOutside).not.toHaveBeenCalled()
    // still closes on a click outside it that is not on the banner
    click(document.getElementById('root')!)
    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  test('a popup opened from the banner is in the banner’s tier, above modals', () => {
    const App = (p: {modal: boolean}) => (
      <>
        <GlobalOverlay tier="globalError">
          <RouterModal>from banner</RouterModal>
        </GlobalOverlay>
        {p.modal ? <RouterModal>modal</RouterModal> : null}
      </>
    )
    const {rerender} = render(<App modal={false} />)
    rerender(<App modal={true} />)
    expect(entryHolding('from banner')?.hasAttribute('inert')).toBe(false)
    expect(entryHolding('modal')?.hasAttribute('inert')).toBe(true)
  })

  test('the disconnect overlay blocks everything under it, keys included', () => {
    const onEscape = jest.fn()
    const under = jest.fn()
    const App = (p: {disconnected: boolean}) => (
      <>
        <EscapeHandler onESC={under}>app</EscapeHandler>
        <RouterModal onEscape={onEscape}>modal</RouterModal>
        <GlobalOverlay tier="globalError">banner</GlobalOverlay>
        {p.disconnected ? <GlobalOverlay tier="disconnect">disconnected</GlobalOverlay> : null}
        <GlobalOverlay tier="outOfDate">update</GlobalOverlay>
      </>
    )
    const {rerender} = render(<App disconnected={false} />)
    rerender(<App disconnected={true} />)
    expect(paintOrder().map(e => e.textContent)).toEqual(['modal', 'banner', 'disconnected', 'update'])
    expect(entryHolding('banner')?.hasAttribute('inert')).toBe(true)
    expect(entryHolding('modal')?.hasAttribute('inert')).toBe(true)
    expect(entryHolding('update')?.hasAttribute('inert')).toBe(false)
    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()
    expect(under).not.toHaveBeenCalled()
    rerender(<App disconnected={false} />)
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  // GlobalError renders one GlobalOverlay whose tier changes with what it shows
  test('the banner becoming the disconnect overlay takes focus, and gives it back', () => {
    const App = (p: {disconnected: boolean}) => (
      <>
        <button>app</button>
        <GlobalOverlay tier={p.disconnected ? 'disconnect' : 'globalError'}>
          {p.disconnected ? 'disconnected' : 'banner'}
        </GlobalOverlay>
      </>
    )
    const {rerender} = render(<App disconnected={false} />)
    const entry = entryHolding('banner')
    const app = screen.getByText('app')
    app.focus()
    rerender(<App disconnected={true} />)
    expect(entryHolding('disconnected')).toBe(entry)
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(entry)
    rerender(<App disconnected={false} />)
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(app)
  })

  // the expanded error banner's details scroll
  test('a modal opening under the banner leaves it scrolled where it was', () => {
    const App = (p: {modal: boolean}) => (
      <>
        {p.modal ? <RouterModal>modal</RouterModal> : null}
        <GlobalOverlay tier="globalError">
          <div data-testid="details">details</div>
        </GlobalOverlay>
      </>
    )
    const {rerender} = render(<App modal={false} />)
    const details = screen.getByTestId('details')
    details.scrollTop = 120
    rerender(<App modal={true} />)
    expect(paintOrder().map(e => e.textContent)).toEqual(['modal', 'details'])
    expect(details.scrollTop).toBe(120)
  })

  test('an overlay opening under another leaves focus and the selection in it where they were', () => {
    const App = (p: {banner: boolean}) => (
      <>
        {p.banner ? <GlobalOverlay tier="globalError">banner</GlobalOverlay> : null}
        <GlobalOverlay tier="outOfDate">
          <input aria-label="field" defaultValue="hello world" />
        </GlobalOverlay>
      </>
    )
    const {rerender} = render(<App banner={false} />)
    const field = screen.getByLabelText<HTMLInputElement>('field')
    field.focus()
    field.setSelectionRange(2, 5)
    const refocused = jest.fn()
    field.addEventListener('focus', refocused)
    rerender(<App banner={true} />)
    expect(paintOrder().map(e => e.textContent)).toEqual(['banner', ''])
    expect(document.activeElement).toBe(field)
    expect(refocused).not.toHaveBeenCalled()
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 5])
  })
})
