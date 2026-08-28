/// <reference types="jest" />
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {makeMessageText} from '@/constants/chat/message'
import {authorIsCollapsible, enoughTimeBetweenMessages, getUsernameToShow} from './separator-utils'

const you = 'testuser'
const convID = T.Chat.stringToConversationIDKey('conv1')

const text = (override?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser-mac',
    conversationIDKey: convID,
    text: new HiddenString('hi'),
    timestamp: 1000,
    ...override,
  })

// these system message types have no exported maker
const system = <T2 extends T.Chat.Message>(m: Partial<T2> & {type: T.Chat.MessageType}) => m as T2

describe('enoughTimeBetweenMessages', () => {
  test('needs both timestamps', () => {
    expect(enoughTimeBetweenMessages(undefined, 1)).toBe(false)
    expect(enoughTimeBetweenMessages(1, undefined)).toBe(false)
    expect(enoughTimeBetweenMessages(0, 0)).toBe(false)
  })

  test('is true only past fifteen minutes', () => {
    const fifteen = 1000 * 60 * 15
    expect(enoughTimeBetweenMessages(1 + fifteen, 1)).toBe(false)
    expect(enoughTimeBetweenMessages(2 + fifteen, 1)).toBe(true)
  })

  test('is false when messages arrive out of order', () => {
    expect(enoughTimeBetweenMessages(1, 1000 * 60 * 60)).toBe(false)
  })
})

test('authorIsCollapsible only collapses conversational messages', () => {
  expect(authorIsCollapsible('text')).toBe(true)
  expect(authorIsCollapsible('attachment')).toBe(true)
  expect(authorIsCollapsible('deleted')).toBe(true)
  expect(authorIsCollapsible('systemJoined')).toBe(false)
  expect(authorIsCollapsible(undefined)).toBe(false)
})

describe('getUsernameToShow special message types', () => {
  test('journeycards and joins show nobody', () => {
    expect(getUsernameToShow(system({author: 'testuser-mac', type: 'journeycard'}), undefined, you)).toBe('')
    expect(getUsernameToShow(system({author: 'testuser-mac', type: 'systemJoined'}), undefined, you)).toBe('')
  })

  test('added-to-team credits the adder', () => {
    const m = system<T.Chat.MessageSystemAddedToTeam>({
      adder: 'testuser-mac',
      author: 'someoneelse',
      type: 'systemAddedToTeam',
    })
    expect(getUsernameToShow(m, undefined, you)).toBe('testuser-mac')
  })

  test('invite accepted hides your own acceptance', () => {
    const invitee = (name: string) =>
      system<T.Chat.MessageSystemInviteAccepted>({invitee: name, type: 'systemInviteAccepted'})
    expect(getUsernameToShow(invitee('testuser-mac'), undefined, you)).toBe('testuser-mac')
    expect(getUsernameToShow(invitee(you), undefined, you)).toBe('')
  })

  test('sbs resolved credits the prover', () => {
    const m = system<T.Chat.MessageSystemSBSResolved>({
      author: 'someoneelse',
      prover: 'testuser-mac',
      type: 'systemSBSResolved',
    })
    expect(getUsernameToShow(m, undefined, you)).toBe('testuser-mac')
  })

  test('setChannelname is suppressed for #general only', () => {
    const rename = (newChannelname: string) =>
      system<T.Chat.MessageSetChannelname>({
        author: 'testuser-mac',
        newChannelname,
        type: 'setChannelname',
      })
    expect(getUsernameToShow(rename('random'), undefined, you)).toBe('testuser-mac')
    expect(getUsernameToShow(rename('general'), undefined, you)).toBe('')
  })
})

describe('getUsernameToShow sequential collapsing', () => {
  test('shows the author when there is no previous message', () => {
    expect(getUsernameToShow(text(), undefined, you)).toBe('testuser-mac')
  })

  test('shows the author right after a join message', () => {
    const prev = system<T.Chat.MessageSystemJoined>({author: 'testuser-mac', type: 'systemJoined'})
    expect(getUsernameToShow(text(), prev, you)).toBe('testuser-mac')
  })

  test('collapses a same-author follow up', () => {
    expect(getUsernameToShow(text({timestamp: 2000}), text(), you)).toBe('')
  })

  test('shows the author when the previous message is someone else', () => {
    expect(getUsernameToShow(text({author: 'other'}), text(), you)).toBe('other')
  })

  test('shows the author when the bot changes', () => {
    const prev = text({botUsername: 'botone'})
    expect(getUsernameToShow(text({botUsername: 'bottwo'}), prev, you)).toBe('testuser-mac')
  })

  test('shows the author again after a long gap', () => {
    const prev = text({timestamp: 1000})
    const later = text({timestamp: 1000 + 1000 * 60 * 16})
    expect(getUsernameToShow(later, prev, you)).toBe('testuser-mac')
  })

  test('does not collapse across a non collapsible type', () => {
    const prev = text()
    const m = system<T.Chat.MessageRequestPayment>({
      author: 'testuser-mac',
      timestamp: 2000,
      type: 'requestPayment',
    })
    expect(getUsernameToShow(m, prev, you)).toBe('testuser-mac')
  })
})
