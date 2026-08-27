/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, render} from '@testing-library/react'
import {Box2} from '../../box'
import type * as Styles from '@/styles'
import type {MeasureRef} from '../../measure-ref'
import {RelativeFloatingBox} from './relative-floating-box.desktop'

const VIEWPORT = 1000

const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect

// the popup box itself; jsdom always measures 0x0 so we stub the measurement
let popupRect = makeRect(0, 0, 100, 60)

const makeAttachTo = (rect: DOMRect): React.RefObject<MeasureRef | null> => ({
  current: {
    divRef: {current: null},
    getBoundingClientRect: () => rect,
    measure: () => undefined,
  } as unknown as MeasureRef,
})

type Positioned = {top: string; left: string; right: string; bottom: string; opacity: string}

const positionOf = (
  position: Styles.Position,
  attachRect: DOMRect,
  extra: {
    matchDimension?: boolean
    offset?: number
    positionFallbacks?: ReadonlyArray<Styles.Position>
    attach?: boolean
  } = {}
): Positioned => {
  const {attach = true, ...rest} = extra
  const {container} = render(
    <RelativeFloatingBox
      attachTo={attach ? makeAttachTo(attachRect) : undefined}
      onClosePopup={() => {}}
      position={position}
      {...rest}
    >
      <Box2 direction="vertical">content</Box2>
    </RelativeFloatingBox>
  )
  void container
  const modalRoot = document.getElementById('modal-root')!
  const node = modalRoot.lastElementChild as HTMLElement
  const {top, left, right, bottom, opacity} = node.style
  return {bottom, left, opacity, right, top}
}

describe('RelativeFloatingBox positioning', () => {
  beforeEach(() => {
    popupRect = makeRect(0, 0, 100, 60)
    const modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.appendChild(modalRoot)
    Object.defineProperty(document.documentElement, 'clientWidth', {configurable: true, value: VIEWPORT})
    Object.defineProperty(document.documentElement, 'clientHeight', {configurable: true, value: VIEWPORT})
    jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(() => popupRect)
  })
  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    document.getElementById('modal-root')?.remove()
  })

  test('bottom left anchors the popup under the left edge of the target', () => {
    const style = positionOf('bottom left', makeRect(200, 300, 50, 20))
    expect(style.left).toBe('200px')
    expect(style.top).toBe('320px')
    expect(style.right).toBe('auto')
    expect(style.bottom).toBe('auto')
  })

  test('top right anchors off the far edges', () => {
    const style = positionOf('top right', makeRect(200, 300, 50, 20))
    // right is measured from the viewport's right edge to the target's right edge
    expect(style.right).toBe(`${VIEWPORT - 250}px`)
    expect(style.bottom).toBe(`${VIEWPORT - 300}px`)
    expect(style.left).toBe('auto')
    expect(style.top).toBe('auto')
  })

  test('bottom center horizontally centers the popup on the target', () => {
    const style = positionOf('bottom center', makeRect(200, 300, 50, 20))
    // (targetWidth - popupWidth) / 2 = (50 - 100) / 2 = -25
    expect(style.left).toBe('175px')
    expect(style.top).toBe('320px')
  })

  test('matchDimension pins both horizontal edges to the target', () => {
    const style = positionOf('bottom center', makeRect(200, 300, 50, 20), {matchDimension: true})
    expect(style.left).toBe('200px')
    expect(style.right).toBe(`${VIEWPORT - 250}px`)
  })

  test('offset pushes the popup away from the anchored edges', () => {
    const plain = positionOf('bottom left', makeRect(200, 300, 50, 20))
    const offset = positionOf('bottom left', makeRect(200, 300, 50, 20), {offset: 8})
    expect(plain.left).toBe('200px')
    expect(offset.left).toBe('208px')
    // vertically the offset pulls the popup back toward the target
    expect(offset.top).toBe('312px')
  })

  test('a position that would run off the bottom falls back to another position', () => {
    // target near the bottom: 'bottom left' would put the popup below the viewport
    const style = positionOf('bottom left', makeRect(200, 980, 50, 20))
    expect(style.top).toBe('auto')
    expect(style.bottom).toBe(`${VIEWPORT - 980}px`)
  })

  test('with only an unusable fallback the popup is pushed back into the viewport', () => {
    const style = positionOf('bottom left', makeRect(200, 980, 50, 20), {
      positionFallbacks: ['bottom left'],
    })
    // 1000 (target bottom) + 60 (popup height) overflows by 60, so it is pushed up
    expect(style.top).toBe('940px')
  })

  test('a popup running off the right edge is pushed left', () => {
    const style = positionOf('bottom left', makeRect(960, 300, 20, 20), {
      positionFallbacks: ['bottom left'],
    })
    expect(style.left).toBe('900px')
  })

  test('no attach target renders hidden instead of mispositioned', () => {
    const style = positionOf('bottom left', makeRect(0, 0, 0, 0), {attach: false})
    expect(style.opacity).toBe('0')
    expect(style.top).toBe('')
    expect(style.left).toBe('')
  })

  test('renders nothing when there is no modal root', () => {
    document.getElementById('modal-root')?.remove()
    const {container} = render(
      <RelativeFloatingBox
        attachTo={makeAttachTo(makeRect(200, 300, 50, 20))}
        onClosePopup={() => {}}
        position="bottom left"
      >
        <Box2 direction="vertical">content</Box2>
      </RelativeFloatingBox>
    )
    expect(container.innerHTML).toBe('')
  })
})
