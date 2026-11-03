/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type {GetOptionsRet} from '@/constants/types/router'
import * as NavTree from '@/constants/nav-tree'
import {StackActions, useNavigation} from '@react-navigation/core'
import {ModalHeader, modalSizeStyles} from './screen-layout-modal.desktop'
import {flush} from '@/test/flush'
import {RouteModal, overlayEntries, setupOverlayDom, showModals} from '@/test/overlay-dom.desktop'

setupOverlayDom()

// A headerTitle component that forgets its Kb.Text renders bare text into the header.
// It must still come out in the Header style, not the browser default.
const BareTitle = () => <>Join a team</>

const elementHolding = (container: HTMLElement, text: string) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent === text) return n.parentElement as HTMLElement
  }
  throw new Error(`no text node "${text}"`)
}

describe('desktop ModalHeader', () => {
  afterEach(cleanup)

  test('a string title renders in a Header Text', () => {
    const {container} = render(<ModalHeader title="Join a team" />)
    expect(elementHolding(container, 'Join a team').classList.contains('text_Header')).toBe(true)
  })

  test('bare text from a title component inherits the Header style', () => {
    const {container} = render(<ModalHeader title={<BareTitle />} />)
    const style = elementHolding(container, 'Join a team').style
    expect(style.fontFamily).toBe('Keybase')
    expect(style.fontWeight).toBe('700')
    expect(style.fontSize).toBe('18px')
    expect(style.lineHeight).toBe('22px')
  })
})

describe('desktop modal sizes', () => {
  test('small sizes to its content up to the cap; medium and large are fixed', () => {
    expect(modalSizeStyles).toEqual({
      large: {height: '80%', width: '80%'},
      medium: {height: 'min(560px, 85vh)', width: 560},
      small: {maxHeight: 'min(560px, 85vh)', width: 400},
    })
  })
})

describe('desktop ModalWrapper', () => {
  afterEach(cleanup)

  const BoxSize = () => <>{`size:${Kb.useModalBox()?.size ?? 'none'}`}</>

  // what a field inside the modal closes it with: its route's own navigation
  const usePop = () => {
    const navigation = useNavigation()
    return () => navigation.dispatch(StackActions.pop())
  }

  // one modal route open over the chat tab, on the real navigation tree
  const renderWith = (options: GetOptionsRet, children: React.ReactNode) => {
    const nav = showModals([
      {name: 'chatNewChat', render: () => <RouteModal navigationOptions={options}>{children}</RouteModal>},
    ])
    return {isOpen: () => NavTree.modalStack(nav.getRootState()).length > 0, nav}
  }
  const renderModal = (options: GetOptionsRet) => renderWith(options, <BoxSize />)

  test('the close X sits outside the clip box that holds the header and body', () => {
    renderModal({title: 'Edit team info'})
    // the body renders bare text, so the element holding it is the body box, inside the clip box
    const body = elementHolding(document.body, 'size:small')
    expect(body.style.minHeight).toBe('0')
    const clip = body.parentElement as HTMLElement
    expect(clip.style.overflow).toBe('hidden')
    expect(clip.contains(elementHolding(document.body, 'Edit team info'))).toBe(true)
    const close = screen.getByTestId(TestIDs.MODAL_CLOSE)
    expect(clip.contains(close)).toBe(false)
    expect(close.parentElement).toBe(clip.parentElement)
  })

  test('the close X closes it', () => {
    const {isOpen} = renderModal({title: 'Edit team info'})
    fireEvent.click(screen.getByTestId(TestIDs.MODAL_CLOSE))
    expect(isOpen()).toBe(false)
  })

  test('the header is a fixed 48px', () => {
    renderModal({title: 'Edit team info'})
    let header: HTMLElement | null = elementHolding(document.body, 'Edit team info')
    while (header && header.style.height !== '48px') header = header.parentElement
    expect(header).not.toBeNull()
  })

  test.each([
    [undefined, 'small'],
    ['medium', 'medium'],
    ['large', 'large'],
  ] as const)('modalSize %s gives the body a %s box', (modalSize, size) => {
    renderModal(modalSize ? {modalSize} : {})
    expect(elementHolding(document.body, `size:${size}`)).toBeTruthy()
  })

  // e.g. new chat's "Search Keybase" field
  test('a field that focuses on mount has focus once the modal is open', () => {
    renderWith({title: 'New chat'}, <input aria-label="search" autoFocus={true} />)
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
  })

  test('a field that focuses in an effect keeps focus', () => {
    const Field = () => {
      const ref = React.useRef<HTMLInputElement>(null)
      React.useEffect(() => {
        ref.current?.focus()
      }, [])
      return <input aria-label="search" ref={ref} />
    }
    renderWith({title: 'New chat'}, <Field />)
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
  })

  test('Escape and a click on the dim area around the box close it', () => {
    const escaped = renderWith({title: 'Edit team info'}, <>body</>)
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(escaped.isOpen()).toBe(false)

    const clicked = renderWith({title: 'Edit team info'}, <>body</>)
    const background = overlayEntries()[0]?.firstElementChild as HTMLElement
    // a press in the box that is released outside it is a drag, not a click
    fireEvent.mouseDown(screen.getByText('body'), {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(clicked.isOpen()).toBe(true)
    fireEvent.mouseDown(background, {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(clicked.isOpen()).toBe(false)
  })

  // people search: its empty search field closes the modal on Escape itself and stops the event
  describe('a field that closes the modal on Escape', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    const Field = () => {
      const pop = usePop()
      const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          pop()
          e.stopPropagation()
        }
      }
      return <input aria-label="search" onKeyDown={onKeyDown} />
    }

    // As in the app, outside act: the pop renders its new state in a transition, on React's
    // schedule, so the modal is still up when the overlay hands a stopped Escape back to it on a
    // 0ms timer. The fake timers run that one; React's scheduler keeps the real setTimeout it
    // captured at load, so the commit waits for the flush.
    const actEnvironment = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}
    const pressEscapeIn = async (field: HTMLElement) => {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
      try {
        field.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'}))
        jest.runOnlyPendingTimers()
      } finally {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
      }
      jest.useRealTimers()
      await flush()
    }

    // a second pop would have nothing to remove: the library refuses it, and fail-on-console fails
    // the test on that refusal
    test('closes it once', async () => {
      const {isOpen} = renderWith({title: 'Search'}, <Field />)
      await pressEscapeIn(screen.getByLabelText('search'))
      expect(isOpen()).toBe(false)
    })

    test('leaves the modal under it open', async () => {
      const nav = showModals([
        {name: 'chatNewChat', render: () => <RouteModal navigationOptions={{title: 'Lower'}}>lower</RouteModal>},
        {
          name: 'chatCreateChannel',
          render: () => (
            <RouteModal navigationOptions={{title: 'Upper'}}>
              <Field />
            </RouteModal>
          ),
        },
      ])
      await pressEscapeIn(screen.getByLabelText('search'))
      expect(NavTree.modalStack(nav.getRootState()).map(r => r.name)).toEqual(['chatNewChat'])
    })
  })

  test('overlayNoClose keeps it open on Escape and clicks, and keeps Escape from what is under it', () => {
    const {isOpen} = renderWith({overlayNoClose: true, title: 'Must answer'}, <>body</>)
    const ev = fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(ev).toBe(false)
    const background = overlayEntries()[0]?.firstElementChild as HTMLElement
    fireEvent.mouseDown(background, {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(isOpen()).toBe(true)
  })
})
