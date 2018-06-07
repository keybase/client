// @flow
/* eslint-env jest */
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import * as Types from '../../constants/types/chat2'
import reducer from '../teams'

jest.unmock('immutable')

describe('teams reducer', () => {
  const teamname = 'keybaseteam'
  const conversationIDKey = Types.stringToConversationIDKey('0')

  const initialState = Constants.makeState({})

  it('setTeamChannelInfo action', () => {
    const channelInfo = Constants.makeChannelInfo({
      channelname: 'somechannel',
      description: 'some topic',
      participants: I.Set(['chris', 'mike']),
    })

    const setAction = TeamsGen.createSetTeamChannelInfo({
      teamname,
      conversationIDKey,
      channelInfo,
    })

    const state1 = reducer(initialState, setAction)
    expect(state1.getIn(['teamNameToChannelInfos', teamname, conversationIDKey])).toEqual(channelInfo)
  })
})
