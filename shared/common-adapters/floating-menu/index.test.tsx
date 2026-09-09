/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import FloatingMenu from '.'

const items = [{onClick: () => {}, title: 'an item'}]

describe('FloatingMenu visibility', () => {
  afterEach(() => {
    cleanup()
  })

  // 'modal' used to skip this guard and rely on Popup dropping an invisible
  // popup on the way past. Popup no longer takes visible, so the guard is the
  // only thing keeping a hidden menu off the screen.
  test.each([undefined, 'bottomsheet', 'modal'] as const)(
    'renders nothing when hidden in %s mode',
    mode => {
      const {container} = render(
        <FloatingMenu closeOnSelect={true} items={items} mode={mode} onHidden={() => {}} visible={false} />
      )
      expect(container.innerHTML).toBe('')
    }
  )
})
