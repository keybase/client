/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {Box2} from '../box'
import {GlobalKeyEventHandler} from '../key-event-handler.desktop'
import {ModalCover} from './modal-cover.desktop'

const renderCover = (onHidden?: () => void) => {
  const {container} = render(
    <GlobalKeyEventHandler>
      <ModalCover onHidden={onHidden}>
        <Box2 direction="vertical">content</Box2>
      </ModalCover>
    </GlobalKeyEventHandler>
  )
  return {
    content: screen.getByText('content'),
    cover: container.firstElementChild as HTMLElement,
  }
}

const pressEscape = () => {
  fireEvent.keyDown(document.body, {key: 'Escape'})
}

describe('ModalCover', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders its children on the cover', () => {
    const {content, cover} = renderCover(() => {})
    expect(cover.contains(content)).toBe(true)
  })

  test('a press that starts and ends on the cover dismisses', () => {
    const onHidden = jest.fn()
    const {cover} = renderCover(onHidden)
    fireEvent.mouseDown(cover)
    fireEvent.mouseUp(cover)
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  test('a release on the cover with no press on it does not dismiss', () => {
    const onHidden = jest.fn()
    const {cover} = renderCover(onHidden)
    fireEvent.mouseUp(cover)
    expect(onHidden).not.toHaveBeenCalled()
  })

  // dragging a selection out of the content and releasing on the cover must not
  // close the popup
  test('a press that starts on the content and ends on the cover does not dismiss', () => {
    const onHidden = jest.fn()
    const {content, cover} = renderCover(onHidden)
    fireEvent.mouseDown(content)
    fireEvent.mouseUp(cover)
    expect(onHidden).not.toHaveBeenCalled()
  })

  test('a release on the content does not dismiss even after pressing the cover', () => {
    const onHidden = jest.fn()
    const {content, cover} = renderCover(onHidden)
    fireEvent.mouseDown(cover)
    fireEvent.mouseUp(content)
    expect(onHidden).not.toHaveBeenCalled()
  })

  test('escape dismisses', () => {
    const onHidden = jest.fn()
    renderCover(onHidden)
    pressEscape()
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  test('other keys do not dismiss', () => {
    const onHidden = jest.fn()
    renderCover(onHidden)
    fireEvent.keyDown(document.body, {key: 'Enter'})
    expect(onHidden).not.toHaveBeenCalled()
  })

  test('without onHidden neither escape nor a cover press throws', () => {
    const {cover} = renderCover()
    expect(() => {
      fireEvent.mouseDown(cover)
      fireEvent.mouseUp(cover)
      pressEscape()
    }).not.toThrow()
  })
})
