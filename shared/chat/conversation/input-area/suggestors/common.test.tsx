/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, render} from '@testing-library/react'
import {List, standardTransformer, type ListHandle, type TransformerData} from './common'

type MockSuggestionListProps = {
  items: Array<string>
  renderItem: (index: number, item: string) => React.ReactElement<{selected: boolean}>
  selectedIndex: number
}
let mockListProps: MockSuggestionListProps | undefined
jest.mock('./suggestion-list', () => ({
  __esModule: true,
  default: (p: MockSuggestionListProps) => {
    mockListProps = p
    return null
  },
}))

const data = (text: string, start: number | null, end: number | null): TransformerData => ({
  position: {end, start},
  text,
})

test('replaces the typed fragment and leaves the caret after a trailing space', () => {
  const {selection, text} = standardTransformer('@testuser', data('hey @test', 4, 9), false)
  expect(text).toBe('hey @testuser ')
  expect(selection).toEqual({end: 14, start: 14})
})

test('a preview insert adds no trailing space and keeps the caret tight', () => {
  const {selection, text} = standardTransformer('@testuser', data('hey @test', 4, 9), true)
  expect(text).toBe('hey @testuser')
  expect(selection).toEqual({end: 13, start: 13})
})

test('keeps whatever follows the replaced fragment, tight against punctuation', () => {
  const {selection, text} = standardTransformer('@testuser', data('hey @test!', 4, 9), false)
  expect(text).toBe('hey @testuser!')
  expect(selection).toEqual({end: 13, start: 13})
})

test('non-punctuation trailing text still gets a separating space', () => {
  const {text} = standardTransformer('@testuser', data('hey @test5', 4, 9), false)
  expect(text).toBe('hey @testuser 5')
})

test('an unmeasured selection inserts at the front and keeps the whole text', () => {
  const {selection, text} = standardTransformer(':wave:', data('hello', null, null), false)
  expect(text).toBe(':wave: hello')
  expect(selection).toEqual({end: 7, start: 7})
})

test('inserting into an empty composer just leaves the insertion', () => {
  expect(standardTransformer('/giphy', data('', 0, 0), false).text).toBe('/giphy ')
})

test('a following newline is left alone rather than pushed along by a space', () => {
  const {selection, text} = standardTransformer('@testuser', data('hey @test\nbye', 4, 9), false)
  expect(text).toBe('hey @testuser\nbye')
  expect(selection).toEqual({end: 13, start: 13})
})

test('does not stack a second space when the following text already leads with one', () => {
  const {selection, text} = standardTransformer('@testuser', data('hey @test how are you', 4, 9), false)
  expect(text).toBe('hey @testuser how are you')
  // caret lands right after the mention, in front of the space that was already there
  expect(selection).toEqual({end: 13, start: 13})
})

describe('List', () => {
  afterEach(() => {
    cleanup()
    mockListProps = undefined
  })

  const setup = (items: Array<string>) => {
    let move: ((up: boolean) => void) | undefined
    let submit: (() => boolean) | undefined
    const onSelected = jest.fn()
    const Item = (p: {selected: boolean; item: string}) => <>{p.item}</>
    const view = (next: Array<string>) => (
      <List
        items={next}
        ItemRenderer={Item}
        keyExtractor={item => item}
        loading={false}
        listStyle={{}}
        spinnerStyle={{}}
        rowHeight={20}
        onSelected={onSelected}
        setListHandle={h => {
          move = h?.move
          submit = h?.submit
        }}
      />
    )
    const utils = render(view(items))
    return {
      move: (up: boolean) => act(() => move?.(up)),
      onSelected,
      rerender: (next: Array<string>) => utils.rerender(view(next)),
      submit: () => submit?.(),
    }
  }
  const highlighted = () =>
    mockListProps?.items.filter((item, i) => mockListProps?.renderItem(i, item).props.selected)

  test('picks the first item when the highlight was left past the end of a narrower list', () => {
    const list = setup(['testuser', 'testuser-mac', 'testuser2', 'testuser3'])
    list.move(false)
    list.move(false)
    list.move(false)
    list.onSelected.mockClear()

    list.rerender(['testuser', 'testuser-mac'])

    expect(highlighted()).toEqual(['testuser'])
    expect(list.submit()).toBe(true)
    expect(list.onSelected).toHaveBeenCalledWith('testuser', true)
  })

  test('an empty list has nothing to pick', () => {
    const list = setup([])

    expect(list.submit()).toBe(false)
    expect(list.onSelected).not.toHaveBeenCalled()
  })

  test('tells the composer whether it shows items, and lets go of its handle when it closes', () => {
    let handle: ListHandle | undefined
    const Item = (p: {selected: boolean; item: string}) => <>{p.item}</>
    const view = (items: Array<string>) => (
      <List
        items={items}
        ItemRenderer={Item}
        keyExtractor={(item: string) => item}
        loading={false}
        listStyle={{}}
        spinnerStyle={{}}
        rowHeight={20}
        onSelected={jest.fn()}
        setListHandle={h => (handle = h)}
      />
    )
    const {rerender, unmount} = render(view([]))
    expect(handle?.hasItems()).toBe(false)

    rerender(view(['testuser']))
    expect(handle?.hasItems()).toBe(true)

    unmount()
    expect(handle).toBeUndefined()
  })

  // a key reads the handle when it lands, so one swapped out under it would see no list
  test('hands over one handle for as long as it is open, which reads the items as they are now', () => {
    const setListHandle = jest.fn((_h: ListHandle | undefined) => {})
    const onSelected = jest.fn()
    const Item = (p: {selected: boolean; item: string}) => <>{p.item}</>
    // every parent render makes a new items array and new callbacks
    const view = (items: Array<string>) => (
      <List
        items={[...items]}
        ItemRenderer={Item}
        keyExtractor={(item: string) => item}
        loading={false}
        listStyle={{}}
        spinnerStyle={{}}
        rowHeight={20}
        onSelected={(item: string, final: boolean) => {
          onSelected(item, final)
        }}
        setListHandle={h => {
          setListHandle(h)
        }}
      />
    )
    const {rerender, unmount} = render(view([]))
    rerender(view([]))
    rerender(view(['testuser']))
    rerender(view(['testuser', 'testuser-mac']))

    expect(setListHandle).toHaveBeenCalledTimes(1)
    const handle = setListHandle.mock.calls[0]?.[0]
    expect(handle?.hasItems()).toBe(true)
    expect(handle?.submit()).toBe(true)
    expect(onSelected).toHaveBeenLastCalledWith('testuser', true)

    unmount()
    expect(setListHandle).toHaveBeenCalledTimes(2)
    expect(setListHandle).toHaveBeenLastCalledWith(undefined)
  })
})
