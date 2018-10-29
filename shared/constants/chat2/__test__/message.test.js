// @flow
/* eslint-env jest */
import * as RPCChatTypes from '../../types/rpc-chat-gen'
import * as Constants from '../message'
import * as Types from '../../types/chat2'

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
      'systemGitPush',
      'systemInviteAccepted',
      'systemSimpleToComplex',
      'systemText',
    ],
  },
  {in: RPCChatTypes.commonMessageType.deletehistory, out: []},
  {in: RPCChatTypes.commonMessageType.reaction, out: []},
  {in: RPCChatTypes.commonMessageType.sendpayment, out: ['sendPayment']},
  {in: RPCChatTypes.commonMessageType.requestpayment, out: ['requestPayment']},
]

describe('serviceMessageTypeToMessageTypes', () => {
  it('returns the expected types', () => {
    cases.forEach(c => expect(Constants.serviceMessageTypeToMessageTypes(c.in).sort()).toEqual(c.out.sort()))
  })
  it('handles all service message types', () => {
    const handledTypes = cases.map(c => c.in)
    const serviceTypes = Object.values(RPCChatTypes.commonMessageType)
    expect(handledTypes.sort()).toEqual(serviceTypes.sort())
  })
})

describe('ordinal counting is clean', () => {
  it('doesnt leave leftover fractions', () => {
    let cur = Types.numberToOrdinal(2343)
    for (var i = 0; i < 999; ++i) {
      const next = Constants.nextFractionalOrdinal(cur)
      // Always of the form .001, .002, or 0.01, 0.1
      expect(String(next).length).toBeLessThanOrEqual('2343.001'.length)
      // always going up by one
      expect((Types.ordinalToNumber(next) * 1000) % 1000).toEqual(
        ((Types.ordinalToNumber(cur) * 1000) % 1000) + 1
      )
      cur = next
    }
  })
})
