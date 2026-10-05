/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import {ModalHeader} from './screen-layout-modal.desktop'

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
