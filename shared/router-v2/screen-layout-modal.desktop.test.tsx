/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type {GetOptionsRet} from '@/constants/types/router'
import {ModalHeader, ModalWrapper, modalSizeStyles} from './screen-layout-modal.desktop'
import {overlayEntries, setupOverlayDom} from '@/test/overlay-dom.desktop'

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

  const renderModal = (options: GetOptionsRet) =>
    render(
      <ModalWrapper canGoBack={false} navigation={{pop: () => {}} as never} navigationOptions={options}>
        <BoxSize />
      </ModalWrapper>
    )

  test('the close X sits outside the clip box that holds the header and body', () => {
    const {getByTestId} = renderModal({title: 'Edit team info'})
    // the body renders bare text, so the element holding it is the body box, inside the clip box
    const body = elementHolding(document.body, 'size:small')
    expect(body.style.minHeight).toBe('0')
    const clip = body.parentElement as HTMLElement
    expect(clip.style.overflow).toBe('hidden')
    expect(clip.contains(elementHolding(document.body, 'Edit team info'))).toBe(true)
    const close = getByTestId(TestIDs.MODAL_CLOSE)
    expect(clip.contains(close)).toBe(false)
    expect(close.parentElement).toBe(clip.parentElement)
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

  const renderWith = (options: GetOptionsRet, children: React.ReactNode) => {
    const pop = jest.fn()
    render(
      <ModalWrapper canGoBack={false} navigation={{pop} as never} navigationOptions={options}>
        {children}
      </ModalWrapper>
    )
    return pop
  }

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
    const pop = renderWith({title: 'Edit team info'}, <>body</>)
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(pop).toHaveBeenCalledTimes(1)
    const background = overlayEntries()[0]?.firstElementChild as HTMLElement
    fireEvent.mouseDown(background, {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(pop).toHaveBeenCalledTimes(2)
    // a press in the box that is released outside it is a drag, not a click
    fireEvent.mouseDown(screen.getByText('body'), {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(pop).toHaveBeenCalledTimes(2)
  })

  test('overlayNoClose keeps it open on Escape and clicks, and keeps Escape from what is under it', () => {
    const pop = renderWith({overlayNoClose: true, title: 'Must answer'}, <>body</>)
    const ev = fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(ev).toBe(false)
    const background = overlayEntries()[0]?.firstElementChild as HTMLElement
    fireEvent.mouseDown(background, {clientX: 1, clientY: 1})
    fireEvent.mouseUp(background, {clientX: 1, clientY: 1})
    expect(pop).not.toHaveBeenCalled()
  })
})
