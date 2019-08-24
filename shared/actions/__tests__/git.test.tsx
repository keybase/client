/* eslint-env jest */
import * as Tabs from '../../constants/tabs'
import * as GitGen from '../git-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import gitSaga from '../git'
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

const gitRepos = [
  {
    canDelete: true,
    chatDisabled: false,
    devicename: 'My Mac Device',
    id: '1b091b39c3c248a0b97d09a4c46c9224_b3749db074a859d991c71bc28d99d82c',
    lastEditTime: 'a minute ago',
    lastEditUser: 'eifjls092',
    name: 'meta',
    repoID: 'b3749db074a859d991c71bc28d99d82c',
    url: 'keybase://private/eifjls092/meta',
  },
  {
    canDelete: true,
    channelName: 'general',
    chatDisabled: false,
    devicename: 'My Mac Device',
    id: '39ae3a19bf4215414d424677c37dce24_1a53ac017631bfbd59adfeb453c84c2c',
    lastEditTime: 'a few seconds ago',
    lastEditUser: 'eifjls092',
    name: 'tea-shop',
    repoID: '1a53ac017631bfbd59adfeb453c84c2c',
    teamname: 'test_shop_932',
    url: 'keybase://team/test_shop_932/tea-shop',
  },
]

const gitReposRpc = [
  {
    ok: {
      canDelete: true,
      folder: {
        created: false,
        folderType: 3,
        name: 'test_shop_932',
        notificationsOn: false,
        private: true,
      },
      globalUniqueID: '39ae3a19bf4215414d424677c37dce24_1a53ac017631bfbd59adfeb453c84c2c',
      localMetadata: {
        previousRepoName: '',
        pushType: 0,
        refs: null,
        repoName: 'tea-shop',
      },
      repoID: '1a53ac017631bfbd59adfeb453c84c2c',
      repoUrl: 'keybase://team/test_shop_932/tea-shop',
      serverMetadata: {
        ctime: 1534635051000,
        lastModifyingDeviceID: '5fd8f74784674fa33f08724635497018',
        lastModifyingDeviceName: 'My Mac Device',
        lastModifyingUsername: 'eifjls092',
        mtime: 1534635052000,
      },
      teamRepoSettings: {
        channelName: 'general',
        chatDisabled: false,
      },
    },
    state: 1,
  },
  {
    ok: {
      canDelete: true,
      folder: {
        created: false,
        folderType: 1,
        name: 'eifjls092',
        notificationsOn: false,
        private: true,
      },
      globalUniqueID: '1b091b39c3c248a0b97d09a4c46c9224_b3749db074a859d991c71bc28d99d82c',
      localMetadata: {
        previousRepoName: '',
        pushType: 0,
        refs: null,
        repoName: 'meta',
      },
      repoID: 'b3749db074a859d991c71bc28d99d82c',
      repoUrl: 'keybase://private/eifjls092/meta',
      serverMetadata: {
        ctime: 1534634997000,
        lastModifyingDeviceID: '5fd8f74784674fa33f08724635497018',
        lastModifyingDeviceName: 'My Mac Device',
        lastModifyingUsername: 'eifjls092',
        mtime: 1534634998000,
      },
    },
    state: 1,
  },
]

const nowTimestamp = 1534635058000

const loadedStore = {
  ...initialStore,
  git: {
    ...initialStore.git,
    idToInfo: gitRepos.reduce((m, r) => m.set(r.id, r), new Map()),
  },
}

const startOnGitTab = dispatch => {
  dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.gitTab]}))
}

const startReduxSaga = Testing.makeStartReduxSaga(gitSaga, initialStore, startOnGitTab)
const startReduxSagaWithLoadedStore = Testing.makeStartReduxSaga(gitSaga, loadedStore, startOnGitTab)

// const getRoute = getState => getRoutePath(getState().routeTree.routeState, [Tabs.gitTab])
// const getRouteState = getState => getRoutePathState(getState().routeTree.routeState, [Tabs.gitTab])

describe('reload side effects', () => {
  let init
  let rpc
  beforeEach(() => {
    init = startReduxSaga()
    rpc = jest.spyOn(RPCTypes, 'gitGetAllGitMetadataRpcPromise')
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('loads on load', () => {
    const {dispatch} = init
    expect(rpc).not.toHaveBeenCalled()
    dispatch(GitGen.createLoadGit())
    expect(rpc).toHaveBeenCalled()
  })

  it("doesn't load on logged out", () => {
    init = startReduxSaga(blankStore) // logged out store
    const {dispatch} = init
    dispatch(GitGen.createLoadGit())
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('load', () => {
  let init
  let rpc
  let date
  beforeEach(() => {
    init = startReduxSaga()
    date = jest.spyOn(Date, 'now')
    date.mockImplementation(() => nowTimestamp)
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('load leads to loaded', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'gitGetAllGitMetadataRpcPromise')
    rpc.mockImplementation(() => Promise.resolve(gitReposRpc))

    dispatch(GitGen.createLoadGit())
    return Testing.flushPromises().then(() => {
      expect(getState().git.idToInfo).toEqual(loadedStore.git.idToInfo)
      expect(rpc).toHaveBeenCalled()
    })
  })

  it('loaded handles null', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'gitGetAllGitMetadataRpcPromise')
    rpc.mockImplementation(() => Promise.resolve())
    dispatch(GitGen.createLoadGit())
    return Testing.flushPromises().then(() => {
      expect(getState().git.idToInfo).toEqual(new Map())
      expect(rpc).toHaveBeenCalled()
    })
  })
})

describe('Team Repos', () => {
  let init
  let rpc
  let date
  beforeEach(() => {
    init = startReduxSagaWithLoadedStore()
    date = jest.spyOn(Date, 'now')
    date.mockImplementation(() => nowTimestamp)
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('Expands the correct team repo on nav', () => {
    const {dispatch} = init
    dispatch(
      GitGen.createNavigateToTeamRepo({
        repoID: '1a53ac017631bfbd59adfeb453c84c2c',
        teamname: 'test_shop_932',
      })
    )
    // expect(getRoute(getState)).toEqual(I.List([Tabs.gitTab]))
    // expect(getRouteState(getState)).toEqual(
    // I.Map({
    // expandedSet: I.Set(['39ae3a19bf4215414d424677c37dce24_1a53ac017631bfbd59adfeb453c84c2c']),
    // })
    // )
  })

  it('Calls the correct rpc on setting team repo settings', () => {
    rpc = jest.spyOn(RPCTypes, 'gitSetTeamRepoSettingsRpcPromise')
    const {dispatch} = init
    dispatch(
      GitGen.createSetTeamRepoSettings({
        chatDisabled: true,
        repoID: '1a53ac017631bfbd59adfeb453c84c2c',
        teamname: 'test_shop_932',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })
})

describe('Create / Delete', () => {
  let init
  let rpc
  let date
  beforeEach(() => {
    init = startReduxSagaWithLoadedStore()
    date = jest.spyOn(Date, 'now')
    date.mockImplementation(() => nowTimestamp)
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('Calls Create Personal Repo RPC', () => {
    rpc = jest.spyOn(RPCTypes, 'gitCreatePersonalRepoRpcPromise')
    const {dispatch} = init
    dispatch(
      GitGen.createCreatePersonalRepo({
        name: 'bestIdeaEver',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })

  it('Calls Create Team Repo RPC', () => {
    rpc = jest.spyOn(RPCTypes, 'gitCreateTeamRepoRpcPromise')
    const {dispatch} = init
    dispatch(
      GitGen.createCreateTeamRepo({
        name: 'bestIdeaEver',
        notifyTeam: true,
        teamname: 'cowtober',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })

  it('Calls Delete Personal Repo RPC', () => {
    rpc = jest.spyOn(RPCTypes, 'gitDeletePersonalRepoRpcPromise')
    const {dispatch} = init
    dispatch(
      GitGen.createDeletePersonalRepo({
        name: 'bestIdeaEver',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })

  it('Calls Delete Team Repo RPC', () => {
    rpc = jest.spyOn(RPCTypes, 'gitDeleteTeamRepoRpcPromise')
    const {dispatch} = init
    dispatch(
      GitGen.createDeleteTeamRepo({
        name: 'bestIdeaEver',
        notifyTeam: true,
        teamname: 'cowtober',
      })
    )
    expect(rpc).toHaveBeenCalled()
  })
})
