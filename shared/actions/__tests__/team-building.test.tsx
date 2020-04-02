/* eslint-env jest */
import * as TeamBuildingGen from '../team-building-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {chatTeamBuildingSaga} from '../chat2'
import * as Testing from '../../util/testing'
import * as Types from '../../constants/types/team-building'

const testNamespace = 'chat2'

jest.mock('../../engine/require')

// We want to be logged in usually
const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  config: {...blankStore.config, deviceID: '999', loggedIn: true, username: 'username'},
}

const startReduxSaga = Testing.makeStartReduxSaga(chatTeamBuildingSaga, initialStore, () => {})

const mockResults: Array<RPCTypes.APIUserSearchResult> = [
  {
    keybase: {
      fullName: 'Marco Munizaga',
      isFollowee: false,
      pictureUrl:
        'https://s3.amazonaws.com/keybase_processed_uploads/67a551a80db42fc190462c28e5785a05_200_200_square_200.jpeg',
      rawScore: 3.0076923076923077,
      stellar: null,
      uid: '4c230ae8d2f922dc2ccc1d2f94890700',
      username: 'marcopolo',
    },
    rawScore: 3.0076923076923077,
    score: 0.5,
    service: {
      bio: '',
      fullName: '',
      location: '',
      pictureUrl: '',
      serviceName: 'github',
      username: 'marcopolo',
    },
    servicesSummary: {
      facebook: {serviceName: 'facebook', username: 'mmunizaga1337'},
      github: {serviceName: 'github', username: 'marcopolo'},
      twitter: {serviceName: 'twitter', username: 'open_sourcery'},
    },
  },
  {
    keybase: {
      fullName: null,
      isFollowee: false,
      pictureUrl:
        'https://s3.amazonaws.com/keybase_processed_uploads/f5bf95bd2d0388e8d0171de9caab6405_200_200.jpeg',
      rawScore: 0.005263157894736842,
      stellar: null,
      uid: '7da8ce717861fe1d98bbbbe617a49719',
      username: 'rustybot',
    },
    rawScore: 0.005263157894736842,
    score: 0.3333333333333333,
    servicesSummary: {},
  },
]

// Maps the user search function to a hashmap, query -> num_wanted -> service -> include_services_summary
const userSearchMock = {
  marcopolo: {
    '11': {
      github: {
        true: mockResults.slice(0, 1),
      },
      keybase: {
        true: mockResults,
      },
    },
  },
}

type searchPromiseParams = RPCTypes.MessageTypes['keybase.1.userSearch.userSearch']['inParam']
const mockUserSearchRpcPromiseRpcPromise = (params: searchPromiseParams) => {
  const {query, maxResults, service, includeServicesSummary} = params
  let result: any
  try {
    const usm: any = userSearchMock
    result = usm[query][maxResults][service][String(includeServicesSummary)]
  } catch (e) {
    throw new Error(
      `userSearchMock not implemented for query: ${query}, num_wanted: ${maxResults}, service: ${service} and ${includeServicesSummary}. Try adding those fields to the userSearchMock hashmap.`
    )
  }
  if (result) {
    return Promise.resolve(result)
  } else {
    return Promise.reject(new Error('No mock result found'))
  }
}

const expectedGithub: Array<Types.User> = [
  {
    id: 'marcopolo@github+marcopolo',
    pictureUrl:
      'https://s3.amazonaws.com/keybase_processed_uploads/67a551a80db42fc190462c28e5785a05_200_200_square_200.jpeg',
    prettyName: 'Marco Munizaga',
    serviceId: 'github',
    serviceMap: {
      facebook: 'mmunizaga1337',
      github: 'marcopolo',
      keybase: 'marcopolo',
      twitter: 'open_sourcery',
    },
    username: 'marcopolo',
  },
]

const expectedKeybase: Array<Types.User> = [
  {
    id: 'marcopolo',
    prettyName: 'Marco Munizaga',
    serviceId: 'keybase',
    serviceMap: {
      facebook: 'mmunizaga1337',
      github: 'marcopolo',
      keybase: 'marcopolo',
      twitter: 'open_sourcery',
    },
    username: 'marcopolo',
  },
  {
    id: 'rustybot',
    prettyName: 'rustybot',
    serviceId: 'keybase',
    serviceMap: {
      keybase: 'rustybot',
    },
    username: 'rustybot',
  },
]

const parsedSearchResults = {
  marcopolo: {
    github: {marcopolo: {github: expectedGithub}},
    keybase: {marcopolo: {keybase: expectedKeybase}},
  },
}
const parsedSearchResultsMap = {
  marcopolo: {
    github: new Map([['marcopolo', new Map([['github', expectedGithub]])]]),
    keybase: new Map([['marcopolo', new Map([['keybase', expectedKeybase]])]]),
  },
}

describe('Search Actions', () => {
  let init: ReturnType<typeof startReduxSaga>
  let rpc: any
  beforeEach(() => {
    init = startReduxSaga()
    rpc = jest.spyOn(RPCTypes, 'userSearchUserSearchRpcPromise')
    rpc.mockImplementation(mockUserSearchRpcPromiseRpcPromise)
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('Calls search', () => {
    const {dispatch} = init
    expect(rpc).not.toHaveBeenCalled()
    dispatch(
      TeamBuildingGen.createSearch({
        includeContacts: false,
        namespace: testNamespace,
        query: 'marcopolo',
        service: 'keybase',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })

  it('Parses the search results', () => {
    const {dispatch, getState} = init
    const query = 'marcopolo'
    const service = 'keybase'
    expect(rpc).not.toHaveBeenCalled()
    dispatch(
      TeamBuildingGen.createSearch({
        includeContacts: false,
        namespace: testNamespace,
        query,
        service,
      })
    )
    expect(getState().chat2.teamBuilding.searchQuery).toEqual('marcopolo')
    expect(getState().chat2.teamBuilding.selectedService).toEqual('keybase')
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.searchResults).toEqual(parsedSearchResultsMap[query][service])
    })
  })

  it('Parses the search result for service', () => {
    const {dispatch, getState} = init
    const query = 'marcopolo'
    const service = 'github'
    expect(rpc).not.toHaveBeenCalled()
    dispatch(
      TeamBuildingGen.createSearch({
        includeContacts: false,
        namespace: testNamespace,
        query,
        service,
      })
    )
    expect(getState().chat2.teamBuilding.searchQuery).toEqual('marcopolo')
    expect(getState().chat2.teamBuilding.selectedService).toEqual('github')
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.searchResults).toEqual(parsedSearchResultsMap[query][service])
    })
  })

  it('Adds users to the team so far', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults.marcopolo.keybase.marcopolo.keybase[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace: testNamespace, users: [userToAdd]}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.teamSoFar).toEqual(new Set([userToAdd]))
    })
  })

  it('Remove users to the team so far', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults.marcopolo.keybase.marcopolo.keybase[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace: testNamespace, users: [userToAdd]}))
    dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({namespace: testNamespace, users: ['marcopolo']}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.teamSoFar).toEqual(new Set())
    })
  })

  it('Moves finished team over and clears the teamSoFar on finished', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults.marcopolo.keybase.marcopolo.keybase[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace: testNamespace, users: [userToAdd]}))
    dispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace: testNamespace}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.teamSoFar).toEqual(new Set())
      expect(getState().chat2.teamBuilding.finishedTeam).toEqual(new Set([userToAdd]))
    })
  })

  it('Cancel team building clears the state', () => {
    const {dispatch, getState} = init
    const userToAdd = parsedSearchResults.marcopolo.keybase.marcopolo.keybase[0]
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace: testNamespace, users: [userToAdd]}))
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace: testNamespace}))
    return Testing.flushPromises().then(() => {
      expect(getState().chat2.teamBuilding.teamSoFar).toEqual(new Set())
      expect(getState().chat2.teamBuilding.finishedTeam).toEqual(new Set())
    })
  })
})

describe('Extra search', () => {
  let init: ReturnType<typeof startReduxSaga>
  let rpc: any
  beforeEach(() => {
    init = startReduxSaga()
    rpc = jest.spyOn(RPCTypes, 'userSearchUserSearchRpcPromise')
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('does not fire additional search for non-keybase or non-phone/email queries', () => {
    const {dispatch} = init
    rpc.mockImplementation(async (params: searchPromiseParams) => {
      if (params.service === 'phone' || params.service === 'email') {
        throw new Error('Unexpected mock call')
      }
      return []
    })
    for (let service of ['twitter', 'keybase'] as Types.ServiceIdWithContact[]) {
      dispatch(
        TeamBuildingGen.createSearch({
          includeContacts: false,
          namespace: testNamespace,
          query: 'marco',
          service,
        })
      )
      expect(rpc).toBeCalled()
    }
  })

  it('prepends extra search result', async () => {
    const {dispatch, getState} = init
    rpc.mockImplementation(
      async (params: searchPromiseParams): Promise<RPCTypes.APIUserSearchResult[]> => {
        if (params.service === 'email' && params.query === 'marco@keyba.se') {
          return [
            {
              imptofu: {
                assertion: '[marco@keyba.se]@email',
                assertionKey: 'phone',
                assertionValue: 'marco@keyba.se',
                keybaseUsername: '',
                label: '',
                prettyName: '',
              },
              rawScore: 1,
              score: 0.5,
              servicesSummary: {},
            },
          ]
        }
        return []
      }
    )
    for (let query of ['marco@keyba.se', 'michal@keyba.se']) {
      dispatch(
        TeamBuildingGen.createSearch({
          includeContacts: false,
          namespace: testNamespace,
          query,
          service: 'keybase',
        })
      )
      await Testing.flushPromises()
    }
    const results = getState().chat2.teamBuilding.searchResults
    const expected = new Map([
      ['michal@keyba.se', new Map([['keybase', []]])],
      [
        'marco@keyba.se',
        new Map([
          [
            'keybase',
            [
              {
                id: '[marco@keyba.se]@email',
                label: '',
                prettyName: 'marco@keyba.se',
                serviceId: 'phone',
                serviceMap: {keybase: ''},
                username: 'marco@keyba.se',
              },
            ],
          ],
        ]),
      ],
    ])
    expect(results).toEqual(expected)
  })
})
