// @flow
/* eslint-env jest */
import * as RPCChatTypes from '../../types/rpc-chat-gen'
import {serviceMessageTypeToMessageTypes} from '../message'

const cases = [
  {in: RPCChatTypes.commonMessageType.none, out: []},
  {in: RPCChatTypes.commonMessageType.text, out: ['text']},
  {in: RPCChatTypes.commonMessageType.attachment, out: ['attachment']},
  {in: RPCChatTypes.commonMessageType.edit, out: []},
  {in: RPCChatTypes.commonMessageType.delete, out: []},
  {in: RPCChatTypes.commonMessageType.metadata, out: ['setDescription']},
  {in: RPCChatTypes.commonMessageType.tlfname, out: []},
  {in: RPCChatTypes.commonMessageType.headline, out: ['setChannelname']},
  {in: RPCChatTypes.commonMessageType.attachmentuploaded, out: ['attachment']},
  {in: RPCChatTypes.commonMessageType.join, out: ['systemJoined']},
  {in: RPCChatTypes.commonMessageType.leave, out: ['systemLeft']},
  {
    in: RPCChatTypes.commonMessageType.system,
    out: [
      'systemAddedToTeam',
      'systemChangeRetention',
      'systemGitPush',
      'systemInviteAccepted',
      'systemSimpleToComplex',
      'systemText',
    ],
  },
  {in: RPCChatTypes.commonMessageType.deletehistory, out: []},
  {in: RPCChatTypes.commonMessageType.reaction, out: []},
  {in: RPCChatTypes.commonMessageType.unfurl, out: []},
  {in: RPCChatTypes.commonMessageType.sendpayment, out: ['sendPayment']},
  {in: RPCChatTypes.commonMessageType.requestpayment, out: ['requestPayment']},
]

describe('serviceMessageTypeToMessageTypes', () => {
  it('returns the expected types', () => {
    cases.forEach(c => expect(serviceMessageTypeToMessageTypes(c.in).sort()).toEqual(c.out.sort()))
  })
  it('handles all service message types', () => {
    const handledTypes = cases.map(c => c.in)
    const serviceTypes = Object.values(RPCChatTypes.commonMessageType)
    expect(handledTypes.sort()).toEqual(serviceTypes.sort())
  })
})
