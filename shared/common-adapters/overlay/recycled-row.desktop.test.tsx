/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {render} from '@testing-library/react'
import {RelativeFloatingBox} from '../popup/floating-box/relative-floating-box.desktop'
import {RecycledRow} from './recycled-row.desktop'
import {setupOverlayDom} from '@/test/overlay-dom.desktop'

setupOverlayDom()
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// A row whose popup state is not keyed to the item it shows, as a list that recycles rows reuses it.
const Row = (p: {item: string; onHidden: () => void; outside: React.RefObject<HTMLElement | null>}) => {
  const {item, onHidden, outside} = p
  const anchor = React.useRef<HTMLDivElement>(null)
  return (
    <RecycledRow rowKey={item}>
      <div ref={anchor}>{item}</div>
      <RelativeFloatingBox attachTo={anchor} onHidden={onHidden} position="bottom left">
        menu for the row
      </RelativeFloatingBox>
      <RelativeFloatingBox attachTo={outside} onHidden={onHidden} position="bottom left">
        anchored elsewhere
      </RelativeFloatingBox>
    </RecycledRow>
  )
}

test('popups anchored in a row close when the row is recycled for another item', () => {
  const onHidden = jest.fn()
  const elsewhere = document.createElement('div')
  document.body.append(elsewhere)
  const outside = {current: elsewhere}
  const {rerender} = render(<Row item="first" onHidden={onHidden} outside={outside} />)
  rerender(<Row item="first" onHidden={onHidden} outside={outside} />)
  expect(onHidden).not.toHaveBeenCalled()
  rerender(<Row item="second" onHidden={onHidden} outside={outside} />)
  // only the one anchored in the row
  expect(onHidden).toHaveBeenCalledTimes(1)
  elsewhere.remove()
})
