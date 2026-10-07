/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import ModalFooter from './modal-footer'

const footerOf = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('ModalFooter', () => {
  afterEach(cleanup)

  test('draws a top divider on desktop by default', () => {
    const {container} = render(<ModalFooter>buttons</ModalFooter>)
    expect(footerOf(container).style.borderTopWidth).toBe('1px')
  })

  test('divider={false} leaves it off, for a footer over a colored body', () => {
    const {container} = render(<ModalFooter divider={false}>buttons</ModalFooter>)
    expect(footerOf(container).style.borderTopWidth).toBe('')
  })
})
