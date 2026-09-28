/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import {List, standardTransformer, type ListHandle, type TransformerData} from './common'

type MockSuggestionListProps = {items: Array<string>; selectedIndex: number}
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

  const setup = (
    items: Array<string>,
    opts?: {filter?: string; keyExtractor?: (item: string, idx: number) => string}
  ) => {
    let handle: ListHandle | undefined
    const onSelected = jest.fn()
    const Item = (p: {selected: boolean; item: string}) => <>{p.item}</>
    const keyExtractor = opts?.keyExtractor ?? ((item: string) => item)
    const view = (next: Array<string>, filter: string) => (
      <List
        filter={filter}
        items={next}
        ItemRenderer={Item}
        keyExtractor={keyExtractor}
        loading={false}
        listStyle={{}}
        spinnerStyle={{}}
        rowHeight={20}
        onSelected={onSelected}
        setListHandle={h => (handle = h)}
      />
    )
    const utils = render(view(items, opts?.filter ?? 't'))
    return {
      handle: () => handle,
      move: (up: boolean) => act(() => handle?.move(up)),
      onSelected,
      rerender: (next: Array<string>, filter: string) => utils.rerender(view(next, filter)),
      submit: () => handle?.submit(),
      unmount: utils.unmount,
    }
  }
  const shown = () => mockListProps?.items
  const highlighted = () => mockListProps?.items[mockListProps.selectedIndex]

  test('moving previews the newly highlighted item, wrapping at the ends', () => {
    const list = setup(['testuser', 'testuser-mac', 'testuser2'])

    list.move(false)
    expect(list.onSelected).toHaveBeenLastCalledWith('testuser-mac', false)
    list.move(true)
    list.move(true)

    expect(list.onSelected).toHaveBeenLastCalledWith('testuser2', false)
    expect(highlighted()).toBe('testuser2')
  })

  test('a new filter starts the highlight again from its first item, without a preview', () => {
    const list = setup(['testuser', 'testuser-mac', 'testuser2', 'testuser3'], {filter: 't'})
    list.move(false)
    list.move(false)
    list.onSelected.mockClear()

    list.rerender(['testuser', 'testuser-mac', 'testuser2', 'testuser3'], 'te')

    expect(highlighted()).toBe('testuser')
    expect(list.onSelected).not.toHaveBeenCalled()
    list.move(false)
    expect(list.onSelected).toHaveBeenLastCalledWith('testuser-mac', false)
  })

  test('going back to an earlier filter starts from the first item too, not where it was left', () => {
    const list = setup(['testuser', 'testuser-mac', 'testuser2'], {filter: 't'})
    list.move(false)
    list.move(false)

    list.rerender(['testuser', 'testuser-mac', 'testuser2'], 'te')
    list.rerender(['testuser', 'testuser-mac', 'testuser2'], 't')

    expect(highlighted()).toBe('testuser')
    expect(list.submit()).toBe(true)
    expect(list.onSelected).toHaveBeenLastCalledWith('testuser', true)
  })

  // the emoji list keys its rows by position, so a new filter that yields as many rows has the same keys
  test('a new filter starts again from the first item even when the rows are keyed by position', () => {
    const list = setup([':smile:', ':smiley:', ':smirk:'], {filter: 'sm', keyExtractor: (_, idx) => String(idx)})
    list.move(false)
    list.move(false)

    list.rerender([':smile:', ':smiley:', ':smiling_imp:'], 'smi')

    expect(highlighted()).toBe(':smile:')
    expect(list.submit()).toBe(true)
    expect(list.onSelected).toHaveBeenLastCalledWith(':smile:', true)
  })

  test('while moving, a refresh leaves the list as it was, so the highlight stays on the previewed item', () => {
    const list = setup(['testuser', 'testuser-mac', 'testuser2'])
    list.move(false)
    list.onSelected.mockClear()

    list.rerender(['testuser0', 'testuser', 'testuser-mac', 'testuser2'], 't')
    expect(shown()).toEqual(['testuser', 'testuser-mac', 'testuser2'])
    expect(highlighted()).toBe('testuser-mac')
    list.rerender(['testuser', 'testuser2'], 't')

    expect(shown()).toEqual(['testuser', 'testuser-mac', 'testuser2'])
    expect(highlighted()).toBe('testuser-mac')
    expect(list.onSelected).not.toHaveBeenCalled()
    expect(list.submit()).toBe(true)
    expect(list.onSelected).toHaveBeenCalledWith('testuser-mac', true)
  })

  test('a new filter after moving shows the live items again', () => {
    const list = setup(['testuser', 'testuser-mac'])
    list.move(false)
    list.rerender(['testuser', 'testuser-mac', 'testuser2'], 't')

    list.rerender(['testuser2', 'testuser3'], 'testuser')

    expect(shown()).toEqual(['testuser2', 'testuser3'])
    expect(highlighted()).toBe('testuser2')
  })

  test('before any move, a refresh shows the live items with the first highlighted', () => {
    const list = setup(['testuser', 'testuser-mac'])

    list.rerender(['testuser0', 'testuser', 'testuser-mac'], 't')

    expect(shown()).toEqual(['testuser0', 'testuser', 'testuser-mac'])
    expect(highlighted()).toBe('testuser0')
    expect(list.onSelected).not.toHaveBeenCalled()
  })

  test('items that are the same by name do not trap the highlight', () => {
    const list = setup([':smile:', ':smile:', ':smiley:'], {filter: 'smile', keyExtractor: (_, idx) => String(idx)})

    list.move(false)
    expect(mockListProps?.selectedIndex).toBe(1)
    list.move(false)

    expect(mockListProps?.selectedIndex).toBe(2)
    expect(list.onSelected).toHaveBeenLastCalledWith(':smiley:', false)
  })

  test('moving on an empty list does nothing, and items that arrive later are not previewed', () => {
    const list = setup([])

    list.move(false)
    list.rerender(['testuser', 'testuser-mac'], 't')
    list.rerender(['testuser', 'testuser-mac', 'testuser2'], 't')

    expect(list.onSelected).not.toHaveBeenCalled()
    expect(highlighted()).toBe('testuser')
    expect(list.submit()).toBe(true)
    expect(list.onSelected).toHaveBeenCalledWith('testuser', true)
  })

  test('an empty list has nothing to pick', () => {
    const list = setup([])

    expect(list.submit()).toBe(false)
    expect(list.onSelected).not.toHaveBeenCalled()
  })

  test('tells the composer whether it shows items, and lets go of its handle when it closes', () => {
    const list = setup([])
    expect(list.handle()?.hasItems()).toBe(false)

    list.rerender(['testuser'], 't')
    expect(list.handle()?.hasItems()).toBe(true)

    list.unmount()
    expect(list.handle()).toBeUndefined()
  })

  // a key reads the handle when it lands, so one swapped out under it would see no list
  test('hands over one handle for as long as it is open, which reads the items as they are now', () => {
    const setListHandle = jest.fn((_h: ListHandle | undefined) => {})
    const onSelected = jest.fn()
    const Item = (p: {selected: boolean; item: string}) => <>{p.item}</>
    // every parent render makes a new items array and new callbacks
    const view = (items: Array<string>) => (
      <List
        filter="t"
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
