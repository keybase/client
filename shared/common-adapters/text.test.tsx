/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {cleanup, render} from '@testing-library/react'
import Text from './text'

const span = (container: HTMLElement) => container.firstElementChild as HTMLSpanElement
const classes = (container: HTMLElement) => new Set(span(container).className.split(' '))

describe('Text (desktop)', () => {
  afterEach(cleanup)

  test('defaults to BodySmall and renders its children', () => {
    const {container} = render(<Text>hello</Text>)
    expect(classes(container).has('text_BodySmall')).toBe(true)
    expect(span(container).textContent).toBe('hello')
  })

  test('type drives the class name', () => {
    const {container} = render(<Text type="HeaderBig">hi</Text>)
    expect(classes(container).has('text_HeaderBig')).toBe(true)
  })

  test('link types get the hover underline class, plain types do not', () => {
    const {container} = render(<Text type="BodyPrimaryLink">link</Text>)
    expect(classes(container).has('text_hover-underline')).toBe(true)
    cleanup()
    const plain = render(<Text type="Body">plain</Text>)
    expect(classes(plain.container).has('text_hover-underline')).toBe(false)
  })

  test('boolean props map onto their modifier classes', () => {
    const {container} = render(
      <Text center={true} negative={true} selectable={true} underline={true} underlineNever={true}>
        x
      </Text>
    )
    const cn = classes(container)
    for (const c of [
      'text_center',
      'text_negative',
      'text_selectable',
      'text_underline',
      'text_underlineNever',
    ]) {
      expect(cn.has(c)).toBe(true)
    }
  })

  test('onClick marks the span clickable and fires', () => {
    const onClick = jest.fn()
    const {container} = render(<Text onClick={onClick}>x</Text>)
    expect(classes(container).has('text_clickable')).toBe(true)
    span(container).click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('no onClick means no clickable class', () => {
    const {container} = render(<Text>x</Text>)
    expect(classes(container).has('text_clickable')).toBe(false)
  })

  test('lineClamp 1-5 use css classes', () => {
    for (const n of [1, 2, 3, 4, 5] as const) {
      const {container} = render(<Text lineClamp={n}>x</Text>)
      expect(classes(container).has(`text_lineClamp${n}`)).toBe(true)
      expect(span(container).style.display).toBe('')
      cleanup()
    }
  })

  test('lineClamp above 5 falls back to inline webkit box clamping', () => {
    const {container} = render(<Text lineClamp={7}>x</Text>)
    const el = span(container)
    expect(el.style.display).toBe('-webkit-box')
    expect(el.style.overflow).toBe('hidden')
    expect(classes(container).has('text_lineClamp5')).toBe(false)
  })

  test('a caller style wins over the inline clamp style', () => {
    const {container} = render(<Text lineClamp={7} style={{overflow: 'visible'}}>x</Text>)
    expect(span(container).style.overflow).toBe('visible')
  })

  test('tooltip becomes a data attribute plus the tooltip class', () => {
    const {container} = render(<Text tooltip="more info">x</Text>)
    expect(span(container).getAttribute('data-tooltip')).toBe('more info')
    expect(classes(container).has('tooltip')).toBe(true)
  })

  test('virtualText moves the content into a data attribute and renders no children', () => {
    const {container} = render(<Text virtualText={true}>hidden</Text>)
    const el = span(container)
    expect(el.textContent).toBe('')
    expect(el.getAttribute('data-virtual-text')).toBe('hidden')
    expect(classes(container).has('text_virtualText')).toBe(true)
  })

  test('title and extra className are forwarded', () => {
    const {container} = render(
      <Text title="a title" className="custom">
        x
      </Text>
    )
    expect(span(container).getAttribute('title')).toBe('a title')
    expect(classes(container).has('custom')).toBe(true)
  })

  test('textRef receives the dom node', () => {
    const ref = React.createRef<HTMLSpanElement>() as unknown as React.RefObject<{
      divRef?: unknown
    } | null>
    const {container} = render(<Text textRef={ref as never}>x</Text>)
    expect(ref.current).toBe(span(container))
  })

  test('onContextMenu fires on a context menu event', () => {
    const onContextMenu = jest.fn()
    const {container} = render(<Text onContextMenu={onContextMenu}>x</Text>)
    span(container).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}))
    expect(onContextMenu).toHaveBeenCalledTimes(1)
  })
})
