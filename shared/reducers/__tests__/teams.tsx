/* eslint-env jest */
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/chat2'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import reducer from '../teams'

describe('teams reducer', () => {
  const teamname = 'keybaseteam'
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
      teamname,
    })

    const state1 = reducer(initialState, setAction)
    expect(state1.teamNameToChannelInfos.get(teamname)?.get(conversationIDKey)).toEqual(channelInfo)
  })
})
