// @flow
import React from 'react'
import _ from 'lodash'
import * as Immutable from 'immutable'
import * as ChatConstants from '../constants/chat'
import HiddenString from '../util/hidden-string'
import List from '../chat/conversation/list'
import {Box, Text, Button} from '../common-adapters'
import {globalStyles} from '../styles'

const textGen = (seed: number) => seed + ''
const nameGen = (seed: number) => seed + ''
const deviceGen = (seed: number) => seed + ''
const convIDGen = (seed: number) => seed + ''

const mockTextMessage = (
  authorSeed: number,
  seed: number,
  timestamp,
  messageID,
  you: string,
  messageState
) => ({
  type: 'Text',
  message: new HiddenString(textGen(seed)),
  author: nameGen(authorSeed),
  deviceName: deviceGen(authorSeed),
  deviceType: 'mobile',
  timestamp,
  conversationIDKey: convIDGen(authorSeed),
  messageID,
  you,
  messageState,
  outboxID: null,
  senderDeviceRevokedAt: null,
  key: `messageid-${messageID}`,
  editedCount: 0,
})

const mockMetaData = (authorSeeds: Array<number>) => {
  return new Immutable.Map(
    authorSeeds.map(s => [
      nameGen(s),
      new ChatConstants.MetaDataRecord({
        fullname: nameGen(s),
        brokenTracker: false,
      }),
    ])
  )
}

const mockFollowingMap = (authorSeeds: Array<number>, seedToBool) => {
  return new Immutable.Map(authorSeeds.map(s => [nameGen(s), seedToBool(s)]))
}

const mockListProps = (messages, metaDataMap, you, authorSeeds, moreToLoad) => ({
  firstNewMessageID: null,
  listScrollDownCounter: 0,
  messages: Immutable.List(messages),
  metaDataMap,
  muted: false,
  you,
  followingMap: mockFollowingMap(authorSeeds, () => true),
  moreToLoad,
  onDeleteMessage: (message: ChatConstants.Message) => console.log('on delete message'),
  onEditMessage: (message: ChatConstants.Message, body: string) => console.log('on edit message'),
  onFocusInput: () => console.log('on focus input'),
  onDownloadAttachment: (messageID: ChatConstants.MessageID) => console.log('on load attachment'),
  onLoadMoreMessages: () => console.log('on load more message'),
  onOpenConversation: (conversationIDKey: ChatConstants.ConversationIDKey) =>
    console.log('on open conv'),
  onOpenInFileUI: (filename: string) => console.log('on open in file ui'),
  onOpenInPopup: (message: ChatConstants.AttachmentMessage) => console.log('on open in popup'),
  onRetryAttachment: (message: ChatConstants.AttachmentMessage) =>
    console.log('on retry attachment'),
  onRetryMessage: (outboxID: string) => console.log('on retry message'),
  selectedConversation: null,
  validated: true,
  sidePanelOpen: false,
  editLastMessageCounter: 0,
})

const you = nameGen(0)
class Main extends React.Component {
  state: any
  constructor() {
    super()
    this.state = {
      messages: _.range(0, 100).map(i => mockTextMessage(i % 2, i, Date.now(), i, you, 'sent')),
    }
  }

  _prepend() {
    console.log('prepending message')
    const i = this.state.messages.length
    this.setState({
      messages: _.range(i, i + 10)
        .map(i => mockTextMessage(Math.floor(Math.random() * 2), i, Date.now(), i, you, 'sent'))
        .concat(this.state.messages),
    })
  }

  _addMessage() {
    console.log('adding message')
    const i = this.state.messages.length
    this.setState({
      messages: this.state.messages.concat([
        mockTextMessage(Math.floor(Math.random() * 2), i, Date.now(), i, you, 'sent'),
      ]),
    })
  }

  render() {
    const props: any = mockListProps(this.state.messages, mockMetaData([0, 1]), you, [0, 1], false)

    console.log('rendering chat-only', this.state.messages.length)

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginTop: 40}}>
        <Text type="Body">hi</Text>
        <List {...props} />
        <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
          <Button label="Prepend" type="Primary" onClick={() => this._prepend()} />
          <Button label="Add message" type="Primary" onClick={() => this._addMessage()} />
        </Box>
      </Box>
    )
  }
}

export default Main
