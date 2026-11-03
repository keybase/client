/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import {installNavigation, makeRootState, stateShowing} from '@/test/navigation'
import {
  generateOutboxID,
  getSelectedConversation,
  isUserActivelyLookingAtThisThread,
  threadRouteName,
  uiParticipantsToParticipantInfo,
} from './common'

const convID = T.Chat.stringToConversationIDKey('conv1')
const otherConvID = T.Chat.stringToConversationIDKey('conv2')

// The app's real tree, on a desktop (split) layout, showing this route; the thread route holds the
// selected conversation in its params
const showing = (route: string, params?: object) => {
  installNavigation({rootState: stateShowing(route, {params})})
}
const showingThread = (conversationIDKey = convID) => showing(threadRouteName, {conversationIDKey})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('getSelectedConversation', () => {
  test('is none when no screen is visible', () => {
    // the navigation container is not up yet
    installNavigation({ready: false})
    expect(getSelectedConversation()).toBe(T.Chat.noConversationIDKey)
  })

  test('is none when the visible screen is not the thread', () => {
    // the teams tab is showing the conversation's channel page, which names it too
    installNavigation({
      rootState: makeRootState({
        tab: Tabs.teamsTab,
        tabStack: [{name: 'teamsRoot'}, {name: 'teamChannel', params: {conversationIDKey: convID, teamID: 'team1'}}],
      }),
    })
    expect(getSelectedConversation()).toBe(T.Chat.noConversationIDKey)
  })

  test('is none when the thread route carries no conversation', () => {
    showing(threadRouteName)
    expect(getSelectedConversation()).toBe(T.Chat.noConversationIDKey)
  })

  test('reads the conversation out of the thread route params', () => {
    showingThread()
    expect(getSelectedConversation()).toBe(convID)
  })

  test('a modal over the thread leaves the conversation selected', () => {
    installNavigation({
      rootState: makeRootState({
        above: [{name: 'chatInfoPanel', params: {conversationIDKey: convID}}],
        tabStack: [{name: threadRouteName, params: {conversationIDKey: convID}}],
      }),
    })
    expect(getSelectedConversation()).toBe(convID)
  })
})

describe('isUserActivelyLookingAtThisThread', () => {
  beforeEach(() => {
    showingThread()
    useShellState.setState({active: true, appFocused: true})
  })

  test('true for the selected conversation with a focused, active app', () => {
    expect(isUserActivelyLookingAtThisThread(convID)).toBe(true)
  })

  test('false for another conversation', () => {
    expect(isUserActivelyLookingAtThisThread(otherConvID)).toBe(false)
  })

  test('false when the app is not focused', () => {
    useShellState.setState({appFocused: false})
    expect(isUserActivelyLookingAtThisThread(convID)).toBe(false)
  })

  test('false when the user is idle', () => {
    useShellState.setState({active: false})
    expect(isUserActivelyLookingAtThisThread(convID)).toBe(false)
  })

  test('false when the thread route is not visible', () => {
    showing('profile', {username: 'testuser'})
    expect(isUserActivelyLookingAtThisThread(convID)).toBe(false)
  })
})

describe('uiParticipantsToParticipantInfo', () => {
  test('empty in, empty out', () => {
    expect(uiParticipantsToParticipantInfo([])).toEqual({all: [], contactName: new Map(), name: []})
  })

  test('only inConvName participants land in name, contact names are indexed', () => {
    const participant = (
      assertion: string,
      inConvName: boolean,
      contactName?: string
    ): T.RPCChat.UIParticipant => ({
      assertion,
      contactName,
      inConvName,
      type: T.RPCChat.UIParticipantType.user,
    })
    const participants = [
      participant('testuser', true),
      participant('testuser-two', false),
      participant('1-555-0100@phone', true, 'Some Contact'),
    ]

    expect(uiParticipantsToParticipantInfo(participants)).toEqual({
      all: ['testuser', 'testuser-two', '1-555-0100@phone'],
      contactName: new Map([['1-555-0100@phone', 'Some Contact']]),
      name: ['testuser', '1-555-0100@phone'],
    })
  })
})

describe('generateOutboxID', () => {
  test('is 8 random bytes', () => {
    const id = generateOutboxID()
    expect(id).toHaveLength(8)
    expect(id.every(b => b >= 0 && b <= 255)).toBe(true)
    // two ids in a row should not collide
    expect(T.Chat.rpcOutboxIDToOutboxID(generateOutboxID())).not.toBe(
      T.Chat.rpcOutboxIDToOutboxID(generateOutboxID())
    )
  })
})
