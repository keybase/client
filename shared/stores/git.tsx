import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as dateFns from 'date-fns'
import * as Z from '@/util/zustand'
import debounce from 'lodash/debounce'
import {navigateAppend} from '@/constants/router2'
import {useConfigState} from '@/stores/config'

type Store = T.Immutable<{
  readonly error?: Error
  readonly idToInfo: Map<string, T.Git.GitInfo>
  readonly isNew?: Set<string>
}>

const parseRepos = (results: ReadonlyArray<T.RPCGen.GitRepoResult>) => {
  const errors: Array<Error> = []
  const repos = new Map<string, T.Git.GitInfo>()
  results.forEach(result => {
    if (result.state === T.RPCGen.GitRepoResultState.ok) {
      const parsedRepo = parseRepoResult(result)
      if (parsedRepo) {
        repos.set(parsedRepo.id, parsedRepo)
      }
    } else {
      errors.push(parseRepoError(result))
    }
  })
  return {errors, repos}
}

const parseRepoResult = (result: T.RPCGen.GitRepoResult): T.Git.GitInfo | undefined => {
  if (result.state === T.RPCGen.GitRepoResultState.ok) {
    const r: T.RPCGen.GitRepoInfo = result.ok
    if (r.folder.folderType === T.RPCGen.FolderType.public) {
      // Skip public repos
      return undefined
    }
    const teamname = r.folder.folderType === T.RPCGen.FolderType.team ? r.folder.name : undefined
    return {
      canDelete: r.canDelete,
      channelName: r.teamRepoSettings?.channelName || undefined,
      chatDisabled: !!r.teamRepoSettings?.chatDisabled,
      devicename: r.serverMetadata.lastModifyingDeviceName,
      id: r.globalUniqueID,
      lastEditTime: dateFns.formatDistanceToNow(new Date(r.serverMetadata.mtime), {addSuffix: true}),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      repoID: r.repoID,
      teamname,
      url: r.repoUrl,
    }
  }
  return undefined
}

const parseRepoError = (result: T.RPCGen.GitRepoResult): Error => {
  let errStr: string = 'unknown'
  if (result.state === T.RPCGen.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

const initialStore: Store = {
  error: undefined,
  idToInfo: new Map(),
  isNew: new Set(),
}

export interface State extends Store {
  dispatch: {
    setError: (err?: Error) => void
    clearBadges: () => void
    load: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    setBadges: (set: Set<string>) => void
    resetState: 'default'
    createPersonalRepo: (name: string) => void
    createTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => void
    deletePersonalRepo: (repoName: string) => void
    deleteTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => void
    navigateToTeamRepo: (teamname: string, repoID: string) => void
    setTeamRepoSettings: (
      channelName: string,
      teamname: string,
      repoID: string,
      chatDisabled: boolean
    ) => void
  }
}

export const useGitState = Z.createZustand<State>((set, get) => {
  const callAndHandleError = (f: () => Promise<void>, loadAfter = true) => {
    const wrapper = async () => {
      try {
        await f()
        if (loadAfter) {
          load()
        }
      } catch (error) {
        set(s => {
          s.error = error as Error
        })
      }
    }
    ignorePromise(wrapper())
  }

  const _load = debounce(
    async () => {
      const results = await T.RPCGen.gitGetAllGitMetadataRpcPromise(undefined, S.waitingKeyGitLoading)
      const {errors, repos} = parseRepos(results || [])
      const {setGlobalError} = useConfigState.getState().dispatch
      errors.forEach(e => setGlobalError(e))
      set(s => {
        s.idToInfo = repos
      })
    },
    1000,
    {leading: true, trailing: false}
  )
  const load = () => {
    ignorePromise(_load())
  }
  const dispatch: State['dispatch'] = {
    clearBadges: () => {
      callAndHandleError(async () => {
        await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
      }, false)
    },
    createPersonalRepo: repoName => {
      callAndHandleError(async () => {
        await T.RPCGen.gitCreatePersonalRepoRpcPromise({repoName}, S.waitingKeyGitLoading)
      })
    },
    createTeamRepo: (repoName, teamname, notifyTeam) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await T.RPCGen.gitCreateTeamRepoRpcPromise({notifyTeam, repoName, teamName}, S.waitingKeyGitLoading)
      })
    },
    deletePersonalRepo: repoName => {
      callAndHandleError(async () => {
        await T.RPCGen.gitDeletePersonalRepoRpcPromise({repoName}, S.waitingKeyGitLoading)
      })
    },
    deleteTeamRepo: (repoName, teamname, notifyTeam) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await T.RPCGen.gitDeleteTeamRepoRpcPromise({notifyTeam, repoName, teamName}, S.waitingKeyGitLoading)
      })
    },
    load,
    navigateToTeamRepo: (teamname, repoID) => {
      const f = async () => {
        await _load()
        for (const [, info] of get().idToInfo) {
          if (info.repoID === repoID && info.teamname === teamname) {
            navigateAppend({props: {expanded: info.id}, selected: 'gitRoot'})
            break
          }
        }
      }
      ignorePromise(f())
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyBadgesBadgeState: {
          const {badgeState} = action.payload.params
          get().dispatch.setBadges(new Set(badgeState.newGitRepoGlobalUniqueIDs))
          break
        }
        default:
      }
    },
    resetState: 'default',
    setBadges: b => {
      set(s => {
        s.isNew = b
      })
    },
    setError: err => {
      set(s => {
        s.error = err
      })
    },
    setTeamRepoSettings: (channelName, teamname, repoID, chatDisabled) => {
      callAndHandleError(async () => {
        await T.RPCGen.gitSetTeamRepoSettingsRpcPromise({
          channelName,
          chatDisabled,
          folder: {
            created: false,
            folderType: T.RPCGen.FolderType.team,
            name: teamname,
          },
          repoID,
        })
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

const emptyInfo = {
  canDelete: false,
  chatDisabled: false,
  devicename: '',
  id: '',
  lastEditTime: '',
  lastEditUser: '',
  name: '',
  repoID: '',
  url: '',
}
export const makeGitInfo = (i?: Partial<T.Git.GitInfo>): T.Git.GitInfo =>
  i ? {...emptyInfo, ...i} : emptyInfo
