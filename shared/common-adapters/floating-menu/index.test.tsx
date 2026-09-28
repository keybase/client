/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import FloatingMenu from '.'

const items = [{onClick: () => {}, title: 'an item'}]

describe('FloatingMenu visibility', () => {
  afterEach(() => {
    cleanup()
  })

  test.each([undefined, 'bottomsheet'] as const)(
    'renders nothing when hidden in %s mode',
    mode => {
      const {container} = render(
        <FloatingMenu closeOnSelect={true} items={items} mode={mode} onHidden={() => {}} visible={false} />
      )
      expect(container.innerHTML).toBe('')
    }
  )

  // modal callers mount the menu themselves, so visible doesn't gate it
  test('renders when hidden in modal mode', () => {
    const {container} = render(
      <FloatingMenu closeOnSelect={true} items={items} mode="modal" onHidden={() => {}} visible={false} />
    )
    expect(container.innerHTML).not.toBe('')
  })
})
