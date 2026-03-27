/// <reference types="jest" />
import * as dateFns from 'date-fns'
import * as T from '@/constants/types'
import {findExpandedRepoID, parseRepos} from './parse'

afterEach(() => {
  jest.restoreAllMocks()
})

test('parseRepos parses git metadata and collects repo errors', () => {
  jest.spyOn(dateFns, 'formatDistanceToNow').mockReturnValue('moments ago')

  const {errors, repos} = parseRepos([
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
  ] as const as ReadonlyArray<T.RPCGen.GitRepoResult>)

  expect(repos.get('repo-guid')).toEqual({
    canDelete: true,
    channelName: 'general',
    chatDisabled: false,
    devicename: 'laptop',
    id: 'repo-guid',
    lastEditTime: 'moments ago',
    lastEditUser: 'alice',
    name: 'repo-one',
    repoID: 'repo-id',
    teamname: 'team-one',
    url: 'https://example.invalid/repo-one',
  })
  expect(errors).toEqual([expect.objectContaining({message: 'Git repo error: missing repo'})])
})

test('findExpandedRepoID matches team repo route context against loaded repos', () => {
  const repos = new Map<string, T.Git.GitInfo>([
    [
      'repo-guid',
      {
        canDelete: true,
        chatDisabled: false,
        devicename: 'laptop',
        id: 'repo-guid',
        lastEditTime: 'moments ago',
        lastEditUser: 'alice',
        name: 'repo-one',
        repoID: 'repo-id',
        teamname: 'team-one',
        url: 'https://example.invalid/repo-one',
      },
    ],
  ])

  expect(findExpandedRepoID(repos, 'repo-id', 'team-one')).toBe('repo-guid')
  expect(findExpandedRepoID(repos, 'repo-id', 'team-two')).toBeUndefined()
})
