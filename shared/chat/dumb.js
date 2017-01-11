// @flow
import ConversationHeader from './conversation/header.desktop'
import ConversationInput from './conversation/input.desktop'
import ConversationList from './conversation/list.desktop'
import ConversationBanner from './conversation/banner'
import ConversationSidePanel from './conversation/side-panel/index.desktop'
import ConversationsList from './conversations-list'
import HiddenString from '../util/hidden-string'
import {InboxStateRecord, MetaDataRecord} from '../constants/chat'
import {List, Map} from 'immutable'
import {globalStyles} from '../styles'

import type {ConversationIDKey} from '../constants/chat'

const now = new Date(2016, 4, 20, 4, 20)

const participants = [
  {
    username: 'chris',
    you: true,
  },
  {
    username: 'chrisnojima',
    you: false,
  },
  {
    username: 'oconnor663',
    you: false,
    following: true,
  },
  {
    username: 'cjb',
    you: false,
    broken: true,
  },
]

const messages = [
  {
    type: 'Text',
    message: new HiddenString('one'),
    author: 'chris',
    timestamp: now - 1000 * 100,
    messageID: 1,
    followState: 'You',
    messageState: 'sent',
    outboxID: null,
  },
  {
    type: 'Text',
    message: new HiddenString('two'),
    author: 'chrisnojima',
    timestamp: now - 1000 * 99,
    messageID: 2,
    followState: 'Following',
    messageState: 'sent',
    outboxID: null,
  },
  {
    type: 'Text',
    message: new HiddenString('three'),
    author: 'oconnor663',
    timestamp: now - 1000 * 98,
    messageID: 3,
    followState: 'NotFollowing',
    messageState: 'sent',
    outboxID: null,
  },
  {
    type: 'Text',
    message: new HiddenString('four'),
    author: 'cjb',
    timestamp: now - 1000 * 97,
    messageID: 4,
    followState: 'Broken',
    messageState: 'failed',
    outboxID: null,
  },
  {
    type: 'Text',
    message: new HiddenString('five'),
    author: 'chris',
    timestamp: now - 1000 * 96,
    messageID: 5,
    followState: 'You',
    messageState: 'pending',
    outboxID: null,
  },
]

const metaData = {
  'cjb': MetaDataRecord({fullname: 'Chris Ball'}),
  'chris': MetaDataRecord({fullname: 'Chris Coyne'}),
  'chrisnojima': MetaDataRecord({fullname: 'Chris Nojima'}),
  'oconnor663': MetaDataRecord({fullname: `Jack O'Connor`}),
}

const commonConvoProps = {
  loadMoreMessages: () => console.log('load more'),
  messages: List(messages),
  participants: List(participants),
  moreToLoad: false,
  isRequesting: false,
  onPostMessage: (text: string) => console.log('on post', text),
  selectedConversation: 'convo1',
  emojiPickerOpen: false,
  onShowProfile: (username: string) => console.log('on show profile', username),
  metaData: Map(metaData),
}

const emptyConvoProps = {
  ...commonConvoProps,
  messages: List(),
}

const inbox = [
  new InboxStateRecord({
    info: null,
    participants: List(participants),
    conversationIDKey: 'convo1',
    muted: false,
    time: now,
    snippet: 'five',
    unreadCount: 3,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 2)),
    conversationIDKey: 'convo2',
    muted: false,
    time: now - 1000 * 60 * 60 * 3,
    snippet: '3 hours ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 3)),
    conversationIDKey: 'convo3',
    muted: true,
    time: now - 1000 * 60 * 60 * 24 * 3,
    snippet: '3 days ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 4)),
    conversationIDKey: 'convo5',
    muted: false,
    time: now - 1000 * 60 * 60 * 24 * 30,
    snippet: 'long ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 2)),
    conversationIDKey: 'convo6',
    muted: false,
    time: now - 1000 * 60 * 60 * 3,
    snippet: '3 hours ago',
    unreadCount: 1,
  }),
]

const commonConversationsProps = {
  nowOverride: now,
  inbox: List(inbox),
  onSelectConversation: (key: ConversationIDKey) => console.log('selected', key),
  selectedConversation: null,
  onNewChat: () => console.log('new chat'),
}

const emptyConversationsProps = {
  ...commonConversationsProps,
  inbox: List(),
}

const header = {
  component: ConversationHeader,
  mocks: {
    'Normal': {
      ...commonConvoProps,
    },
    'Empty': {
      ...emptyConvoProps,
    },
  },
}

const input = {
  component: ConversationInput,
  mocks: {
    'Normal': {
      ...commonConvoProps,
    },
    /* FIXME: causes flaky visdiff
    'Emoji Open': {
      ...commonConvoProps,
      emojiPickerOpen: true,
      parentProps: {style: {height: 370, paddingTop: 330}},
    },
    */
    'Empty': {
      ...emptyConvoProps,
    },
  },
}

const listParentProps = {
  style: {
    ...globalStyles.flexBoxColumn,
    width: 300,
    height: 300,
  },
}

const list = {
  component: ConversationList,
  mocks: {
    'Normal': {
      ...commonConvoProps,
      parentProps: listParentProps,
    },
    'Empty': {
      ...emptyConvoProps,
      parentProps: listParentProps,
    },
  },
}

const commonSidePanel = {
  parentProps: {
    style: {
      width: 320,
    },
  },
}

const sidePanel = {
  component: ConversationSidePanel,
  mocks: {
    'Normal': {
      ...commonConvoProps,
      ...commonSidePanel,
    },
    'Empty': {
      ...emptyConvoProps,
      ...commonSidePanel,
    },
  },
}

const conversationsList = {
  component: ConversationsList,
  mocks: {
    'Normal': {
      ...commonConversationsProps,
    },
    'Selected Normal': {
      ...commonConversationsProps,
      selectedConversation: 'convo1',
    },
    'SelectedMuted': {
      ...commonConversationsProps,
      selectedConversation: 'convo3',
    },
    'Empty': {
      ...emptyConversationsProps,
    },
  },
}

const conversationBanner = {
  component: ConversationBanner,
  mocks: {
    'Info': {
      type: 'Info',
      text: 'Some info',
    },
    'Invite': {
      type: 'Invite',
      username: 'malg@twitter',
      inviteLink: 'keybase.io/inv/9999999999',
      onClickInviteLink: () => { console.log('Clicked the invite link') },
    },
    'Error': {
      type: 'Error',
      text: 'Some of jzila’s proofs have changed since you last followed them.',
      textLink: 'Please Review',
      textLinkOnClick: () => { console.log('Clicked the text link') },
    },
  },
}

export default {
  'ChatHeader': header,
  'ChatInput': input,
  'ChatList': list,
  'ChatSidePanel': sidePanel,
  'ChatConversationsList': conversationsList,
  'ChatBanner': conversationBanner,
}
