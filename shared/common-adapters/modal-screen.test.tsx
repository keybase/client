/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import ModalScreen from './modal-screen'
import {ModalBoxContext} from './modal-box'
import type {ModalSize} from '@/constants/types/router'

const elementHolding = (container: HTMLElement, text: string) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent === text) return n.parentElement as HTMLElement
  }
  throw new Error(`no text node "${text}"`)
}

const scrollerAbove = (el: HTMLElement) => {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    if (e.style.overflow === 'auto') return e
  }
  return undefined
}

const inBox = (size: ModalSize, node: React.ReactNode) => (
  <ModalBoxContext value={{size}}>{node}</ModalBoxContext>
)

describe('ModalScreen', () => {
  afterEach(cleanup)

  test('scrolls its body by default, with the standard padding', () => {
    const {container} = render(<ModalScreen>body</ModalScreen>)
    const body = elementHolding(container, 'body')
    expect(scrollerAbove(body)).toBeDefined()
    expect(body.style.padding).toBe('16px')
  })

  test('scroll={false} draws the body in a flex box with no scroller', () => {
    const {container} = render(inBox('medium', <ModalScreen scroll={false}>body</ModalScreen>))
    const body = elementHolding(container, 'body')
    expect(scrollerAbove(body)).toBeUndefined()
    expect(body.className).toContain('box2_flex1')
  })

  test('padding="none" runs the body edge to edge', () => {
    const {container} = render(<ModalScreen padding="none">body</ModalScreen>)
    expect(elementHolding(container, 'body').style.padding).toBe('')
  })

  test('banner, body and footer stack in order', () => {
    const {container} = render(
      <ModalScreen banner="banner" footer="footer">
        body
      </ModalScreen>
    )
    const text = container.textContent ?? ''
    expect(text.indexOf('banner')).toBeLessThan(text.indexOf('body'))
    expect(text.indexOf('body')).toBeLessThan(text.indexOf('footer'))
  })

  describe('dev warning', () => {
    const g = globalThis as {__DEV__?: boolean}
    let warn: jest.SpyInstance
    beforeEach(() => {
      g.__DEV__ = true
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      g.__DEV__ = false
      warn.mockRestore()
    })

    test('warns about scroll={false} in a small box, whose height follows its content', () => {
      render(inBox('small', <ModalScreen scroll={false}>body</ModalScreen>))
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('scroll={false} in a small modal')
    })

    test.each(['medium', 'large'] as const)('is quiet in a %s box', size => {
      render(inBox(size, <ModalScreen scroll={false}>body</ModalScreen>))
      expect(warn).not.toHaveBeenCalled()
    })

    test('is quiet for a scrolling body in a small box', () => {
      render(inBox('small', <ModalScreen>body</ModalScreen>))
      expect(warn).not.toHaveBeenCalled()
    })
  })
})
