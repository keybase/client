import * as C from '.'
import * as T from './types'
import * as dateFns from 'date-fns'
import * as Z from '@/util/zustand'

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

const initialStore: T.Git.State = {
  error: undefined,
  idToInfo: new Map(),
  isNew: new Set(),
}

interface State extends T.Git.State {
  dispatch: {
    setError: (err?: Error) => void
    clearBadges: () => void
    load: () => void
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

export const _useState = Z.createZustand<State>((set, get) => {
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
    C.ignorePromise(wrapper())
  }

  const _load = async () => {
    const results = await T.RPCGen.gitGetAllGitMetadataRpcPromise(undefined, loadingWaitingKey)
    const {errors, repos} = parseRepos(results || [])
    const {setGlobalError} = C.useConfigState.getState().dispatch
    errors.forEach(e => setGlobalError(e))
    set(s => {
      s.idToInfo = repos
    })
  }
  const load = () => {
    C.ignorePromise(_load())
  }
  const dispatch: State['dispatch'] = {
    clearBadges: () => {
      callAndHandleError(async () => {
        await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
      }, false)
    },
    createPersonalRepo: repoName => {
      callAndHandleError(async () => {
        await T.RPCGen.gitCreatePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
      })
    },
    createTeamRepo: (repoName, teamname, notifyTeam) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await T.RPCGen.gitCreateTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
      })
    },
    deletePersonalRepo: repoName => {
      callAndHandleError(async () => {
        await T.RPCGen.gitDeletePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
      })
    },
    deleteTeamRepo: (repoName, teamname, notifyTeam) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await T.RPCGen.gitDeleteTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
      })
    },
    load,
    navigateToTeamRepo: (teamname, repoID) => {
      const f = async () => {
        await _load()
        for (const [, info] of get().idToInfo) {
          if (info.repoID === repoID && info.teamname === teamname) {
            C.useRouterState
              .getState()
              .dispatch.navigateAppend({props: {expanded: info.id}, selected: 'gitRoot'})
            break
          }
        }
      }
      C.ignorePromise(f())
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

export const loadingWaitingKey = 'git:loading'
