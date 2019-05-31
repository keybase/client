/* eslint-env jest */
import * as RPCChatTypes from '../../types/rpc-chat-gen'
import {serviceMessageTypeToMessageTypes} from '../message'

const cases = [
  {in: RPCChatTypes.MessageType.none, out: []},
  {in: RPCChatTypes.MessageType.text, out: ['text']},
  {in: RPCChatTypes.MessageType.attachment, out: ['attachment']},
  {in: RPCChatTypes.MessageType.edit, out: []},
  {in: RPCChatTypes.MessageType.delete, out: []},
  {in: RPCChatTypes.MessageType.metadata, out: ['setDescription']},
  {in: RPCChatTypes.MessageType.tlfname, out: []},
  {in: RPCChatTypes.MessageType.headline, out: ['setChannelname']},
  {in: RPCChatTypes.MessageType.attachmentuploaded, out: ['attachment']},
  {in: RPCChatTypes.MessageType.join, out: ['systemJoined']},
  {in: RPCChatTypes.MessageType.leave, out: ['systemLeft']},
  {
    in: RPCChatTypes.MessageType.system,
    out: [
      'systemAddedToTeam',
      'systemChangeRetention',
      'systemGitPush',
      'systemInviteAccepted',
      'systemSimpleToComplex',
      'systemText',
      'systemUsersAddedToConversation',
    ],
  },
  {in: RPCChatTypes.MessageType.deletehistory, out: []},
  {in: RPCChatTypes.MessageType.reaction, out: []},
  {in: RPCChatTypes.MessageType.unfurl, out: []},
  {in: RPCChatTypes.MessageType.sendpayment, out: ['sendPayment']},
  {in: RPCChatTypes.MessageType.requestpayment, out: ['requestPayment']},
  {in: RPCChatTypes.MessageType.flip, out: []},
]

describe('serviceMessageTypeToMessageTypes', () => {
  it('returns the expected types', () => {
    cases.forEach(c => expect(serviceMessageTypeToMessageTypes(c.in).sort()).toEqual(c.out.sort()))
  })
  it('handles all service message types', () => {
    const handledTypes = cases.map(c => c.in)
    const serviceTypes = Object.values(RPCChatTypes.MessageType).filter(
      k => typeof RPCChatTypes.MessageType[k] !== 'number'
    )
    expect(handledTypes.sort()).toEqual(serviceTypes.sort())
  })
})
