// @flow
import {BrokenTrackerBanner, ErrorBanner, InviteBanner, InfoBanner} from './conversation/banner'
import ConversationHeader from './conversation/header'
import ConversationInput from './conversation/input'
import ConversationList from './conversation/list'
import NoConversation from './conversation/no-conversation'
import ConversationInfoPanel from './conversation/info-panel'
import HiddenString from '../util/hidden-string'
import Inbox from './inbox/container'
import ParticipantRekey from './conversation/rekey/participant-rekey'
import YouRekey from './conversation/rekey/you-rekey'
import {InboxStateRecord, MetaDataRecord, RekeyInfoRecord, StateRecord} from '../constants/chat'
import {List, Map} from 'immutable'
import {globalStyles} from '../styles'
import {RouteStateNode} from '../route-tree'
import {isMobile} from '../constants/platform'

import type {ConversationIDKey} from '../constants/chat'

const now = new Date(2016, 4, 20, 4, 20)

const participants = ['chris', 'chrisnojima', 'oconnor663', 'cjb']

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

const users = [
  {broken: false, following: false, username: 'chrisnojima', you: false},
  {broken: false, following: true, username: 'oconnor663', you: false},
  {broken: true, following: false, username: 'cjb', you: false},
]

const metaData = {
  cjb: MetaDataRecord({fullname: 'Chris Ball', brokenTracker: true}),
  chris: MetaDataRecord({fullname: 'Chris Coyne'}),
  chrisnojima: MetaDataRecord({fullname: 'Chris Nojima'}),
  oconnor663: MetaDataRecord({fullname: `Jack O'Connor`}),
}

const followingMap = {
  oconnor663: true,
  cjb: false,
  chris: false,
  chrisnojima: false,
}

const commonConvoProps = {
  loadMoreMessages: () => console.log('load more'),
  metaDataMap: Map(metaData),
  followingMap,
  messages: List(messages),
  messageKeys: List(),
  users: users,
  moreToLoad: false,
  isRequesting: false,
  onPostMessage: (text: string) => console.log('on post', text),
  selectedConversation: 'convo1',
  onShowProfile: (username: string) => console.log('on show profile', username),
  onBack: () => console.log('back clicked'),
  typing: [],
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
    status: 'unfiled',
    time: now,
    snippet: 'fiveTEMPTEMP',
    unreadCount: 3,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 2)),
    conversationIDKey: 'convo2',
    status: 'unfiled',
    time: now - 1000 * 60 * 60 * 3,
    snippet: '3 hours ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 3)),
    conversationIDKey: 'convo3',
    status: 'muted',
    time: now - 1000 * 60 * 60 * 24 * 3,
    snippet: '3 days ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 4)),
    conversationIDKey: 'convo5',
    status: 'unfiled',
    time: now - 1000 * 60 * 60 * 24 * 30,
    snippet: 'long ago',
    unreadCount: 0,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 2)),
    conversationIDKey: 'convo6',
    status: 'unfiled',
    time: now - 1000 * 60 * 60 * 3,
    snippet: '3 hours ago',
    unreadCount: 1,
  }),
  new InboxStateRecord({
    info: null,
    participants: List(participants.slice(0, 1)),
    conversationIDKey: 'convo7',
    status: 'muted',
    time: now - 1000 * 60 * 60 * 5,
    snippet: '3 hours ago',
    unreadCount: 1,
  }),
]

const conversationUnreadCounts = {
  convo1: 3,
  convo2: 0,
  convo3: 0,
  convo5: 0,
  convo6: 1,
  convo7: 1,
}

const commonConversationsProps = ({selected, inbox: _inbox, rekeyInfos}: any) => ({
  mockStore: {
    chat: new StateRecord({
      conversationUnreadCounts: Map(conversationUnreadCounts),
      inbox: _inbox || List(inbox),
      nowOverride: now,
      pending: List(),
      pendingConversations: List(),
      rekeyInfos: rekeyInfos || Map(),
      selectedConversation: null,
      supersededByState: Map(),
    }),
    config: {
      username: 'chris',
    },
    routeTree: {
      routeState: new RouteStateNode({
        selected: 'tabs:chatTab',
        children: Map({
          'tabs:chatTab': new RouteStateNode({
            selected,
            children: Map({}),
          }),
        }),
      }),
    },
  },
  loadInbox: () => {},
  onNewChat: () => console.log('new chat'),
  onSelectConversation: (key: ConversationIDKey) => console.log('selected', key),
})

const emptyConversationsProps = {
  ...commonConversationsProps({inbox: List()}),
}

const header = {
  component: ConversationHeader,
  mocks: {
    Normal: {
      ...commonConvoProps,
    },
    Muted: {
      ...commonConvoProps,
      muted: true,
    },
    Badged: {
      ...commonConvoProps,
      badgeNumber: 12,
    },
  },
}

const input = {
  component: ConversationInput,
  mocks: {
    Normal: {
      ...commonConvoProps,
    },
    /* FIXME: causes flaky visdiff
    'Emoji Open': {
      ...commonConvoProps,
      emojiPickerOpen: true,
      parentProps: {style: {height: 370, paddingTop: 330}},
    },
    */
  },
}

const listParentProps = {
  style: {
    ...globalStyles.flexBoxColumn,
    minWidth: 300,
    ...(isMobile ? {flex: 1} : {height: 500}),
  },
}

const rekeyConvo = (convo, youCanRekey) => ({
  ...commonConversationsProps({
    selected: convo,
    rekeyInfos: Map({
      convo1: new RekeyInfoRecord({
        rekeyParticipants: List(youCanRekey ? [] : ['jzila']),
        youCanRekey,
      }),
      convo3: new RekeyInfoRecord({
        rekeyParticipants: List(
          youCanRekey
            ? []
            : [
                'jzila',
                'cjb',
                'oconnor663',
                'mpch',
                '0123456789012',
                'one',
                'two',
                'three',
                'four',
                'five',
                'six',
                'seven',
                'eight',
              ]
        ),
        youCanRekey,
      }),
    }),
  }),
})

const participantRekey = {
  component: ParticipantRekey,
  mocks: {
    Normal: {
      ...commonConvoProps,
      onUsernameClicked: (user: string) => {
        console.log(user, 'clicked')
      },
      parentProps: listParentProps,
      rekeyInfo: rekeyConvo(null, false).mockStore.chat.rekeyInfos.get('convo3'),
    },
  },
}

const youRekey = {
  component: YouRekey,
  mocks: {
    Normal: {
      ...commonConvoProps,
      onRekey: () => {
        console.log('Reykey clicked')
      },
      parentProps: listParentProps,
      rekeyInfo: rekeyConvo(null, false).mockStore.chat.rekeyInfos.get('convo3'),
    },
  },
}

const list = {
  component: ConversationList,
  mocks: {
    Empty: {
      ...emptyConvoProps,
      parentProps: listParentProps,
    },
    Normal: {
      ...commonConvoProps,
      parentProps: listParentProps,
    },
  },
}

const commonInfoPanel = {
  parentProps: {
    style: {
      width: 320,
    },
  },
  participants: List(
    participants.map(p => ({
      broken: metaData[p].get('brokenTracker'),
      following: !!followingMap[p],
      fullname: metaData[p].get('fullname'),
      isYou: p === 'chris',
      username: p,
    }))
  ),
}

const infoPanel = {
  component: ConversationInfoPanel,
  mocks: {
    Normal: {
      ...commonInfoPanel,
    },
    Muted: {
      ...commonInfoPanel,
      muted: true,
    },
  },
}

const inboxParentProps = {
  style: {
    ...globalStyles.flexBoxColumn,
    minWidth: 240,
    height: isMobile ? undefined : 500,
  },
}

const conversationsList = {
  component: Inbox,
  mocks: {
    Normal: {
      ...commonConversationsProps({}),
      parentProps: inboxParentProps,
    },
    'Selected Normal': {
      ...commonConversationsProps({selected: 'convo1'}),
      parentProps: inboxParentProps,
    },
    SelectedMuted: {
      ...commonConversationsProps({selected: 'convo3'}),
      parentProps: inboxParentProps,
    },
    Empty: {
      ...emptyConversationsProps,
      parentProps: inboxParentProps,
    },
    PartRekey: {
      ...rekeyConvo('convo3', false),
      parentProps: inboxParentProps,
    },
    PartRekeySelected: {
      ...rekeyConvo('convo1', false),
      parentProps: inboxParentProps,
    },
    YouRekey: {
      ...rekeyConvo('convo3', true),
      parentProps: inboxParentProps,
    },
    YouRekeySelected: {
      ...rekeyConvo('convo1', true),
      parentProps: inboxParentProps,
    },
    LongTop: {
      ...commonConversationsProps({
        inbox: List([
          new InboxStateRecord({
            conversationIDKey: 'convo1',
            info: null,
            status: 'unfiled',
            participants: List([
              'one',
              'two',
              'three',
              'four',
              'five',
              'six',
              'seven',
              'eight',
              'nine',
              'ten',
            ]),
            snippet: 'look up!',
            time: now,
            unreadCount: 3,
          }),
        ]),
      }),
      parentProps: inboxParentProps,
    },
    LongBottom: {
      ...commonConversationsProps({
        inbox: List([
          new InboxStateRecord({
            conversationIDKey: 'convo1',
            info: null,
            status: 'unfiled',
            participants: List(['look down!']),
            snippet: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
            time: now,
            unreadCount: 3,
          }),
        ]),
      }),
      parentProps: inboxParentProps,
    },
  },
}

const brokenTrackerBanner = {
  component: BrokenTrackerBanner,
  mocks: {
    'BrokenTracker 1': {
      users: ['jzila'],
      onClick: (user: string) => {
        console.log('Clicked on ', user)
      },
    },
    'BrokenTracker 2': {
      users: ['jzila', 'cjb'],
      onClick: (user: string) => {
        console.log('Clicked on ', user)
      },
    },
    'BrokenTracker 3': {
      users: ['jzila', 'cjb', 'bob'],
      onClick: (user: string) => {
        console.log('Clicked on ', user)
      },
    },
  },
}

const errorBanner = {
  component: ErrorBanner,
  mocks: {
    Error: {
      text: 'Some error',
      textLink: 'Some link',
      textLinkOnClick: () => {
        console.log('Clicked the text link')
      },
    },
  },
}

const inviteBanner = {
  component: InviteBanner,
  mocks: {
    Invite: {
      inviteLink: 'keybase.io/inv/9999999999',
      onClickInviteLink: () => {
        console.log('Clicked the invite link')
      },
      users: ['malg@twitter'],
    },
  },
}

const infoBanner = {
  component: InfoBanner,
  mocks: {
    Info: {
      text: 'Some info',
    },
  },
}

const noConversationMap = {
  component: NoConversation,
  mocks: {
    normal: {},
  },
}

export default {
  ChatBannerBroken: brokenTrackerBanner,
  ChatBannerError: errorBanner,
  ChatBannerInfo: infoBanner,
  ChatBannerInvite: inviteBanner,
  ChatInbox: conversationsList,
  ChatHeader: header,
  ChatInput: input,
  ChatList: list,
  ChatParticipantRekey: participantRekey,
  ChatInfoPanel: infoPanel,
  ChatNoConversation: noConversationMap,
  YouRekey: youRekey,
}
