/* eslint-env jest */
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/chat2'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import reducer from '../teams'

describe('teams reducer', () => {
  const teamID = '12345abcde'
  const conversationIDKey = Types.stringToConversationIDKey('0')

  const initialState = Constants.makeState({})

  it('setTeamChannelInfo action', () => {
    const channelInfo = {
      ...Constants.initialChannelInfo,
      channelname: 'somechannel',
      description: 'some topic',
      memberStatus: RPCChatTypes.ConversationMemberStatus.active,
    }

    const setAction = TeamsGen.createSetTeamChannelInfo({
      channelInfo,
      conversationIDKey,
      teamID,
    })

    const state1 = reducer(initialState, setAction)
    expect(state1.teamIDToChannelInfos.get(teamID)?.get(conversationIDKey)).toEqual(channelInfo)
  })
})
