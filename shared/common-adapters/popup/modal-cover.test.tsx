/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {Box2} from '../box'
import Input3 from '../input3'
import {ModalCover} from './modal-cover.desktop'
import {overlayEntries, paintOrder, setupOverlayDom} from '@/test/overlay-dom.desktop'

setupOverlayDom()

const renderCover = (onHidden?: () => void) => {
  render(
    <ModalCover onHidden={onHidden}>
      <Box2 alignSelf="center" direction="vertical">content</Box2>
    </ModalCover>
  )
  const [entry] = overlayEntries()
  return {
    content: screen.getByText('content'),
    cover: entry?.firstElementChild as HTMLElement,
    entry,
  }
}

const pressEscape = () => {
  fireEvent.keyDown(document.body, {key: 'Escape'})
}

describe('ModalCover', () => {

  test('renders its children on the cover, in a modal overlay', () => {
    const {content, cover, entry} = renderCover(() => {})
    expect(paintOrder()).toEqual([entry])
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

  // like Kb.SearchFilter: Escape clears what was typed and stops there
  const FilterField = () => {
    const [text, setText] = React.useState('typed')
    return (
      <Input3
        placeholder="filter"
        value={text}
        onChangeText={setText}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setText('')
            e.stopPropagation()
          }
        }}
      />
    )
  }

  describe('an escape a field inside handled', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    const escapeIn = (field: HTMLElement) => {
      fireEvent.keyDown(field, {key: 'Escape'})
      act(() => {
        jest.runAllTimers()
      })
    }

    test('only stopped, still dismisses, after the field took it', () => {
      const onHidden = jest.fn()
      render(
        <ModalCover onHidden={onHidden}>
          <FilterField />
        </ModalCover>
      )
      const field = screen.getByPlaceholderText<HTMLInputElement>('filter')
      escapeIn(field)
      expect(field.value).toBe('')
      expect(onHidden).toHaveBeenCalledTimes(1)
    })

    test('also prevented, is left to the field', () => {
      const onHidden = jest.fn()
      const handle = (e: React.KeyboardEvent) => {
        e.preventDefault()
        e.stopPropagation()
      }
      render(
        <ModalCover onHidden={onHidden}>
          <Input3 placeholder="filter" onKeyDown={handle} />
        </ModalCover>
      )
      escapeIn(screen.getByPlaceholderText('filter'))
      expect(onHidden).not.toHaveBeenCalled()
    })
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
