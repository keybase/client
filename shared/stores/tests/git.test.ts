/// <reference types="jest" />
import * as EngineGen from '@/constants/rpc'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useGitState} from '../git'

const mockSetGlobalError = jest.fn()

jest.mock('@/stores/config', () => ({
  useConfigState: {
    getState: () => ({
      dispatch: {
        setGlobalError: mockSetGlobalError,
      },
    }),
  },
}))

afterEach(() => {
  jest.restoreAllMocks()
  mockSetGlobalError.mockReset()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('load parses git metadata and forwards repo errors to config', async () => {
  const loadGit = jest.spyOn(T.RPCGen, 'gitGetAllGitMetadataRpcPromise').mockResolvedValue([
    {
      ok: {
        canDelete: true,
        folder: {folderType: T.RPCGen.FolderType.team, name: 'team-one'},
        globalUniqueID: 'repo-guid',
        localMetadata: {repoName: 'repo-one'},
        repoID: 'repo-id',
        repoUrl: 'https://example.invalid/repo-one',
        serverMetadata: {
          lastModifyingDeviceName: 'laptop',
          lastModifyingUsername: 'alice',
          mtime: 1_700_000_000_000,
        },
        teamRepoSettings: {channelName: 'general', chatDisabled: false},
      },
      state: T.RPCGen.GitRepoResultState.ok,
    },
    {
      err: 'missing repo',
      state: T.RPCGen.GitRepoResultState.err,
    },
  ] as any)

  useGitState.getState().dispatch.load()
  await flush()

  expect(loadGit).toHaveBeenCalled()
  expect(useGitState.getState().idToInfo.get('repo-guid')?.name).toBe('repo-one')
  expect(useGitState.getState().idToInfo.get('repo-guid')?.teamname).toBe('team-one')
  expect(useGitState.getState().idToInfo.get('repo-guid')?.lastEditUser).toBe('alice')
  expect(mockSetGlobalError).toHaveBeenCalledWith(expect.objectContaining({message: 'Git repo error: missing repo'}))
})

test('badge updates are reflected in local state', () => {
  useGitState
    .getState()
    .dispatch.onEngineIncomingImpl({
      payload: {
        params: {
          badgeState: {
            newGitRepoGlobalUniqueIDs: ['repo-guid-1', 'repo-guid-2'],
          },
        },
      },
      type: EngineGen.keybase1NotifyBadgesBadgeState,
    } as any)

  expect(useGitState.getState().isNew).toEqual(new Set(['repo-guid-1', 'repo-guid-2']))
})
