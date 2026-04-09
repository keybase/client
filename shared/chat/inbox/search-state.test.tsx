/// <reference types="jest" />
import {makeInboxSearchInfo, nextInboxSearchSelectedIndex} from './search-state'

test('inbox search helpers derive stable defaults', () => {
  const info = makeInboxSearchInfo()

  expect(info.query).toBe('')
  expect(info.selectedIndex).toBe(0)
  expect(info.nameStatus).toBe('initial')
  expect(info.textStatus).toBe('initial')
})

test('inbox search selection movement stays within available results', () => {
  const inboxSearch = makeInboxSearchInfo()
  inboxSearch.nameResults = [{conversationIDKey: '1'} as any, {conversationIDKey: '2'} as any]
  inboxSearch.textResults = [{conversationIDKey: '3', query: 'needle', time: 1} as any]

  let selectedIndex = inboxSearch.selectedIndex
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  expect(selectedIndex).toBe(1)

  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  expect(selectedIndex).toBe(2)

  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  expect(selectedIndex).toBe(0)
})
