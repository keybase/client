/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, render} from '@testing-library/react'
import {List, standardTransformer, type ListHandle, type TransformerData} from './common'

jest.mock('./suggestion-list', () => ({__esModule: true, default: () => null}))

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
    expect(handle?.hasItems).toBe(false)

    rerender(view(['testuser']))
    expect(handle?.hasItems).toBe(true)

    unmount()
    expect(handle).toBeUndefined()
  })
})
