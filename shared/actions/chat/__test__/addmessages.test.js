// @noflow
/* eslint-env jest */
import {type TypedState} from '../../../constants/reducer'
import * as Constants from '../../../constants/chat'
import * as Entities from '../../../constants/entities'
import {addMessagesToConversation} from '../thread-content'

function makeState(): TypedState {
  const entityState = Entities.makeState()
  const chatState = Constants.makeState()
  return {
    entities: entityState,
    chat: chatState,
  }
}

function makeMsg(type: string, state: string, id: number): Constants.ServerMessage {
  let ordinalField = 'rawMessageID'
  switch (type) {
    case 'Attachment':
    case 'Text':
      if (state === 'pending' || state === 'failed') {
        ordinalField = 'ordinal'
      }
  }
  return {
    [ordinalField]: id,
    type,
    messageState: state,
    key: id,
  }
}

describe('addMessagesToConversation', () => {
  it('defaults', () => {
    const state = makeState()
    const convIDKey = 'mike'
    const currentMessages = Constants.getConversationMessages(state, convIDKey)
    expect(currentMessages.high).toBe(-1)
    expect(currentMessages.low).toBe(-1)
    expect(currentMessages.messages.size).toBe(0)
  })
  it('basic', () => {
    const state = makeState()
    const convIDKey = 'mike'
    const messages = [
      makeMsg('Text', 'sent', 10),
      makeMsg('Text', 'pending', 11.1),
      makeMsg('Text', 'sent', 12),
    ]
    let newConvMsgs = addMessagesToConversation(state, convIDKey, messages)
    expect(newConvMsgs.high).toBe(12)
    expect(newConvMsgs.low).toBe(10)
    expect(newConvMsgs.messages.get(0)).toBe(10)
    expect(newConvMsgs.messages.get(-1)).toBe(12)
    const appendMessages = [
      makeMsg('Text', 'sent', 8),
      makeMsg('Text', 'sent', 9),
      makeMsg('Text', 'sent', 10),
      makeMsg('Text', 'pending', 11.1),
      makeMsg('Text', 'sent', 12),
      makeMsg('Text', 'pending', 13.001),
    ]
    newConvMsgs = addMessagesToConversation(state, convIDKey, appendMessages)
    expect(newConvMsgs.high).toBe(13.001)
    expect(newConvMsgs.low).toBe(8)
    expect(newConvMsgs.messages.get(0)).toBe(8)
    expect(newConvMsgs.messages.get(-1)).toBe(13.001)
    expect(newConvMsgs.messages.size).toBe(6)
  })
  it('edges', () => {
    const state = makeState()
    const convIDKey = 'mike'
    const messages = []
    let newConvMsgs = addMessagesToConversation(state, convIDKey, messages)
    expect(newConvMsgs.high).toBe(-1)
    expect(newConvMsgs.low).toBe(-1)
    expect(newConvMsgs.messages.size).toBe(0)
  })
})
