// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../../constants/chat'
import {Box} from '../../../common-adapters'
import {dataToRouteState} from '../../../route-tree'
import {storiesOf, action} from '../../../stories/storybook'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import List from './index'
import {range} from 'lodash'
import HiddenString from '../../../util/hidden-string'
import {globalStyles} from '../../../styles'

const you = 'trex'
const conversationIDKey = 'mock'

const users = ['trex', 'xert']
const corpus = [
  `Sorry, other word classes!  I have a NEW girlfriend now!`,
  `Nope. He'd have to earn it! We'd do sports or something to see.`,
  `What?! Seriously? :+1:`,
  `Well, maybe the magazine will pique my interest!`,
  `Insurance motivators? Uh, building complicaters? Domino frustraters? Wobbley Times U.S.A.? Um. . . Shakey Shakes Central? :ghost: `,
  `I'm going for STUNT immortality. I'll just keep kicking that kangaroo until even if somebody wanted to catch up, they'd look at my record and say "Well, THAT'S totally not worth doing".`,
  `FINE. NO I DON'T.`,
  ` Comedy relies on surprise, I think!  There's a twist that makes a joke funny, and I haven't figured out a generative algorithm yet.`,
  `I - I think it's weird. `,
  `Or perhaps like this!`,
  `It occurs to me: every time I do something private, I'm REALLY just betting that technology to look into the arbitrary past won't ever be developed.  Because if it is ever invented, game over, man, game over!  People will be able to look at any moment in history!`,
  `Companies don't want their most popular characters dying of old age!`,
  `The creativity that was required to create hoverbikes has been erased!  Who had the insight now?`,
  `UTAHRAPTOR. His speaking voice sounds like a text-to-speech synthesizer. That is awesome! That is objectively awesome.`,
  `Oh wow! Really?`,
  `Earlier today my nose was like, "Hey, T-Rex! I'm gonna leak blood for no reason!" and I was all "...Awesome?"`,
  `*cough*`,
  `But have you examined Appendix A of my resume, in whice there is an amazingly sweet HOLOGRAPHIC Batman sicker?`,
  `LAH LAH LAH LAH LAH I can't hear you LAH LAH LAH what does God need with erotica anyway LAH LAH LAH LAH don't answer that LAH LAH LAH`,
  ` Oooh, what's this, a sheep?  What are you going to do, PUNCH ME?`,
  `*sigh*`,
  `Dromiceiomimus, I'll give you the punchline and you'll supply the identifiable social group to be mocked, okay? The puchline is: "Just one: they hold the lightbulb still while the world revolves around them."`,
  `Bananas is spelt, "b-a-n-a-n-a-s".`,
  `Baloney! You don't even have a console that can run it.`,
  `I will take what I can get!!`,
  `This has got to stop!`,
  `It turns out you can't make a law saying "dudes nobody say this guy's name anymore okay" without saying his name SOMEWHERE? But, I mean, I understand why they were upset. Kind of a dick move, Herostratus. I want to go down in history, but not for being the world's Suckiest Greek.`,
  `What, you were The Mighty Thor?`,
  `Nothing!!`,
  `Pretty certain it does, Dromiceiomimus!`,
]

const emojiOnly = [':ghost:', ':+1:', ':100:']

function makeMessage(messageID: string, you: string, author: string, timestamp: number, message: string) {
  const key = Constants.messageKey(conversationIDKey, 'messageIDText', messageID)
  return {
    type: 'Text',
    message: new HiddenString(message),
    author,
    deviceName: `${author}-phone`,
    deviceType: 'mobile',
    timestamp,
    conversationIDKey,
    messageID,
    you,
    messageState: 'sent',
    failureDescription: null,
    senderDeviceRevokedAt: null,
    key,
    editedCount: 0,
  }
}

const messageCount = 100
const messageMapFn = (corpus: Array<string>) =>
  range(messageCount).reduce((acc, i) => {
    const m = makeMessage(i, you, users[i % users.length], 1, corpus[i % corpus.length])
    acc[m.key] = m
    return acc
  }, {})

const propCommon = messageMap => ({
  messageKeys: I.List(Object.keys(messageMap)),
  editLastMessageCounter: 0,
  listScrollDownCounter: 0,
  onDeleteMessage: action('onDeleteMessage'),
  onEditMessage: action('onEditMessage'),
  onFocusInput: action('onFocusInput'),
  onDownloadAttachment: action('onDownloadAttachment'),
  onLoadMoreMessages: action('onLoadMoreMessages'),
  onMessageAction: action('onMessageAction'),
  onOpenInFileUI: action('onOpenInFileUI'),
  getMessageFromMessageKey: (messageKey: Constants.MessageKey) => messageMap[messageKey],
  selectedConversation: conversationIDKey,
  validated: true,
  you: 'trex',
})

const mockFn = messageMap => ({
  default: {
    ...propCommon(messageMap),
  },
})

const storeFn = (messageMap: Object) => ({
  config: {
    following: {},
    username: 'tester',
  },
  chat: new Constants.StateRecord({
    // $FlowIssue
    messageMap: new I.Map(messageMap),
    localMessageStates: I.Map(),
    inbox: I.List(),
    inboxFilter: '',
    conversationStates: I.Map(),
    metaData: I.Map(),
    finalizedState: I.Map(),
    supersedesState: I.Map(),
    supersededByState: I.Map(),
    pendingFailures: I.Map(),
    conversationUnreadCounts: I.Map(),
    rekeyInfos: I.Map(),
    alwaysShow: I.Set(),
    pendingConversations: I.Map(),
    nowOverride: null,
    editingMessage: null,
    inboxUntrustedState: 'unloaded',
    previousConversation: null,
    searchPending: false,
    searchResults: null,
    searchShowingSuggestions: false,
    selectedUsersInSearch: I.List(),
    inSearch: false,
    tempPendingConversations: I.Map(),
    searchResultTerm: '',
  }),
  routeTree: dataToRouteState({
    selected: 'tabs:chatTab',
    props: {},
    state: {},
    children: {
      'tabs:chatTab': {
        selected: 'mock',
        props: {},
        state: {},
        children: {
          mock: {
            selected: null,
            props: {},
            state: {},
            children: {},
          },
        },
      },
    },
  }),
})

const load = () => {
  storiesOf('Chat/List', module)
    .add('Normal', () => {
      const messageMap = messageMapFn(corpus)
      const store = storeFn(messageMap)
      const mock = mockFn(messageMap)
      return (
        <Box style={globalStyles.fillAbsolute}>
          <Provider store={createStore(ignore => store, store)}>
            {/* $FlowIssue */}
            <List {...mock.default} />
          </Provider>
        </Box>
      )
    })
    .add('Emoji Only', () => {
      const messageMap = messageMapFn(emojiOnly)
      const store = storeFn(messageMap)
      const mock = mockFn(messageMap)
      return (
        <Box style={globalStyles.fillAbsolute}>
          <Provider store={createStore(ignore => store, store)}>
            {/* $FlowIssue */}
            <List {...mock.default} />
          </Provider>
        </Box>
      )
    })
}

export default load
