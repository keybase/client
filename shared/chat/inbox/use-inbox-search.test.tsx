/// <reference types="jest" />
import {makeInboxSearchInfo, nextInboxSearchSelectedIndex} from './use-inbox-search'

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

test('inbox search selection movement respects visible result counts', () => {
  const inboxSearch = makeInboxSearchInfo()
  inboxSearch.nameResults = [{conversationIDKey: '1'} as any]
  inboxSearch.openTeamsResults = new Array(5).fill({name: 'team'}) as any
  inboxSearch.botsResults = new Array(5).fill({botUsername: 'bot'}) as any
  inboxSearch.textResults = [{conversationIDKey: '2', query: 'needle', time: 1} as any]

  const selectedIndex = nextInboxSearchSelectedIndex(
    {...inboxSearch, selectedIndex: 7},
    true,
    {
      bots: 5,
      names: 1,
      openTeams: 5,
      text: 1,
    }
  )

  expect(selectedIndex).toBe(8)
})
