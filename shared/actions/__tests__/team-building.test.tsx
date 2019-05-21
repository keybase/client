/* eslint-env jest */
import * as I from 'immutable'
import * as TeamBuildingGen from '../team-building-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import teamBuildingSaga from '../chat2/team-building'
import * as Testing from '../../util/testing'

jest.mock('../../engine/require')

// We want to be logged in usually
const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  config: blankStore.config.merge({
    deviceID: '999',
    loggedIn: true,
    username: 'username',
  }),
}

const startReduxSaga = Testing.makeStartReduxSaga(teamBuildingSaga, initialStore, () => {})

// Maps the user search function to a hashmap, query -> num_wanted -> service -> include_services_summary
// note the keybase service is a special case where the service is empty string
const userSearchMock = {
  marcopolo: {
    '11': {
      '': {
        '1': {
          body: `{"status":{"code":0,"name":"OK"},"list":[{"score":0.5,"keybase":{"username":"marcopolo","uid":"4c230ae8d2f922dc2ccc1d2f94890700","picture_url":"https://s3.amazonaws.com/keybase_processed_uploads/67a551a80db42fc190462c28e5785a05_200_200_square_200.jpeg","full_name":"Marco Munizaga","raw_score":3.0076923076923077,"stellar":null},"service":{"service_name":"github","username":"marcopolo","picture_url":null,"bio":null,"location":null,"full_name":null},"services_summary":{"twitter":{"username":"open_sourcery","service_name":"twitter"},"facebook":{"username":"mmunizaga1337","service_name":"facebook"},"github":{"username":"marcopolo","service_name":"github"}}},{"score":0.3333333333333333,"keybase":{"username":"rustybot","uid":"7da8ce717861fe1d98bbbbe617a49719","picture_url":"https://s3.amazonaws.com/keybase_processed_uploads/f5bf95bd2d0388e8d0171de9caab6405_200_200.jpeg","full_name":null,"raw_score":0.005263157894736842,"stellar":null},"services_summary":{}}]}`,
        },
      },
    },
  },
}

const mockApiserverGetWithSessionRpcPromise = ({args, endpoint}) => {
  switch (endpoint) {
    case 'user/user_search':
      const {q, num_wanted, service, include_services_summary} = args.reduce((acc, a) => {
        acc[a.key] = a.value
        return acc
      }, {})
      let result
      try {
        result = userSearchMock[q][num_wanted][service][include_services_summary]
      } catch (e) {
        throw new Error(
          `userSearchMock not implemented for query: ${q}, num_wanted: ${num_wanted}, service: ${service} and ${include_services_summary}. Try adding those fields to the userSearchMock hashmap.`
        )
      }
      if (result) {
        return Promise.resolve(result)
      } else {
        return Promise.reject(new Error('No mock result found'))
      }
    default:
      return Promise.reject(new Error('Not Implemented'))
  }
}

const parsedSearchResults = {
  marcopolo: {
    keybase: I.Map().mergeIn(['marcopolo'], {
      keybase: [
        {
          id: 'marcopolo',
          prettyName: 'Marco Munizaga',
          serviceMap: {
            facebook: 'mmunizaga1337',
            github: 'marcopolo',
            keybase: 'marcopolo',
            twitter: 'open_sourcery',
          },
        },
        {
          id: 'rustybot',
          prettyName: 'rustybot',
          serviceMap: {
            keybase: 'rustybot',
          },
        },
      ],
    }),
  },
}

describe('Search Actions', () => {
  let init
  let rpc
  beforeEach(() => {
    init = startReduxSaga()
    rpc = jest.spyOn(RPCTypes, 'apiserverGetWithSessionRpcPromise')
    rpc.mockImplementation(mockApiserverGetWithSessionRpcPromise)
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('Calls search', () => {
    const {dispatch} = init
    expect(rpc).not.toHaveBeenCalled()
    dispatch(TeamBuildingGen.createSearch({query: 'marcopolo', service: 'keybase'}))
    expect(rpc).toHaveBeenCalled()
  })

  it('Parses the search results', () => {
    const {dispatch, getState} = init
    const query = 'marcopolo'
    const service = 'keybase'
    expect(rpc).not.toHaveBeenCalled()
    dispatch(TeamBuildingGen.createSearch({query: 'marcopolo', service: 'keybase'}))
    expect(getState().chat2.teamBuildingSearchQuery).toEqual('marcopolo')
    expect(getState().chat2.teamBuildingSelectedService).toEqual('keybase')
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuildingSearchResults).toEqual(parsedSearchResults[query][service])
    })
  })

  it('Adds users to the team so far', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults['marcopolo']['keybase'].getIn(['marcopolo', 'keybase'], [])[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [userToAdd]}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuildingTeamSoFar).toEqual(I.Set([userToAdd]))
    })
  })

  it('Remove users to the team so far', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults['marcopolo']['keybase'].getIn(['marcopolo', 'keybase'], [])[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [userToAdd]}))
    dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({users: ['marcopolo']}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuildingTeamSoFar).toEqual(I.Set())
    })
  })

  it('Moves finished team over and clears the teamSoFar on finished', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults['marcopolo']['keybase'].getIn(['marcopolo', 'keybase'], [])[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [userToAdd]}))
    dispatch(TeamBuildingGen.createFinishedTeamBuilding())
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuildingTeamSoFar).toEqual(I.Set())
      expect(getState().chat2.teamBuildingFinishedTeam).toEqual(I.Set([userToAdd]))
    })
  })

  it('Cancel team building clears the state', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults['marcopolo']['keybase'].getIn(['marcopolo', 'keybase'], [])[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [userToAdd]}))
    dispatch(TeamBuildingGen.createCancelTeamBuilding())
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuildingTeamSoFar).toEqual(I.Set())
      expect(getState().chat2.teamBuildingFinishedTeam).toEqual(I.Set())
    })
  })
})
