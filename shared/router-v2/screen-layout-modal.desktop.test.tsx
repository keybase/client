/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type {GetOptionsRet} from '@/constants/types/router'
import {ModalHeader, ModalWrapper, modalSizeStyles} from './screen-layout-modal.desktop'

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
    const {container, getByTestId} = renderModal({title: 'Edit team info'})
    // the body renders bare text, so the element holding it is the body box, inside the clip box
    const body = elementHolding(container, 'size:small')
    expect(body.style.minHeight).toBe('0')
    const clip = body.parentElement as HTMLElement
    expect(clip.style.overflow).toBe('hidden')
    expect(clip.contains(elementHolding(container, 'Edit team info'))).toBe(true)
    const close = getByTestId(TestIDs.MODAL_CLOSE)
    expect(clip.contains(close)).toBe(false)
    expect(close.parentElement).toBe(clip.parentElement)
  })

  test('the header is a fixed 48px', () => {
    const {container} = renderModal({title: 'Edit team info'})
    let header: HTMLElement | null = elementHolding(container, 'Edit team info')
    while (header && header.style.height !== '48px') header = header.parentElement
    expect(header).not.toBeNull()
  })

  test.each([
    [undefined, 'small'],
    ['medium', 'medium'],
    ['large', 'large'],
  ] as const)('modalSize %s gives the body a %s box', (modalSize, size) => {
    const {container} = renderModal(modalSize ? {modalSize} : {})
    expect(elementHolding(container, `size:${size}`)).toBeTruthy()
  })
})
