import type * as Types from './types/git'
import * as dateFns from 'date-fns'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'

const parseRepos = (results: Array<RPCTypes.GitRepoResult>) => {
  const errors: Array<Error> = []
  const repos = new Map<string, Types.GitInfo>()
  results.forEach(result => {
    if (result.state === RPCTypes.GitRepoResultState.ok) {
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

const parseRepoResult = (result: RPCTypes.GitRepoResult): Types.GitInfo | undefined => {
  if (result.state === RPCTypes.GitRepoResultState.ok) {
    const r: RPCTypes.GitRepoInfo = result.ok
    if (r.folder.folderType === RPCTypes.FolderType.public) {
      // Skip public repos
      return undefined
    }
    const teamname = r.folder.folderType === RPCTypes.FolderType.team ? r.folder.name : undefined
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

const parseRepoError = (result: RPCTypes.GitRepoResult): Error => {
  let errStr: string = 'unknown'
  if (result.state === RPCTypes.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

const initialState: Types.State = {
  error: undefined,
  idToInfo: new Map(),
  isNew: new Set(),
}

type ZState = Types.State & {
  dispatch: {
    setError: (err?: Error) => void
    clearBadges: () => void
    load: () => void
    setBadges: (set: Set<string>) => void
    reset: () => void
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

export const useGitState = Container.createZustand(
  Container.immerZustand<ZState>((set, get) => {
    const reduxDispatch = Container.getReduxDispatch()

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
      Container.ignorePromise(wrapper())
    }

    const _load = async () => {
      const results = await RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, loadingWaitingKey)
      const {errors, repos} = parseRepos(results || [])
      errors.forEach(globalError => reduxDispatch(ConfigGen.createGlobalError({globalError})))
      set(s => {
        s.idToInfo = repos
      })
    }
    const load = () => {
      Container.ignorePromise(_load())
    }
    const dispatch = {
      clearBadges: () => {
        callAndHandleError(async () => {
          await RPCTypes.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
        }, false)
      },
      createPersonalRepo: (repoName: string) => {
        callAndHandleError(async () => {
          await RPCTypes.gitCreatePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
        })
      },
      createTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => {
        callAndHandleError(async () => {
          const teamName = {parts: teamname.split('.')}
          await RPCTypes.gitCreateTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
        })
      },
      deletePersonalRepo: (repoName: string) => {
        callAndHandleError(async () => {
          await RPCTypes.gitDeletePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
        })
      },
      deleteTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => {
        callAndHandleError(async () => {
          const teamName = {parts: teamname.split('.')}
          await RPCTypes.gitDeleteTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
        })
      },
      load,
      navigateToTeamRepo: (teamname: string, repoID: string) => {
        const f = async () => {
          await _load()
          for (const [, info] of get().idToInfo) {
            if (info.repoID === repoID && info.teamname === teamname) {
              reduxDispatch(
                RouteTreeGen.createNavigateAppend({
                  path: [{props: {expanded: info.id}, selected: 'gitRoot'}],
                })
              )
              break
            }
          }
        }
        Container.ignorePromise(f())
      },
      reset: () => {
        set(() => initialState)
      },
      setBadges: (b: Set<string>) => {
        set(s => {
          s.isNew = b
        })
      },
      setError: (err?: Error) => {
        set(s => {
          s.error = err
        })
      },
      setTeamRepoSettings: (channelName: string, teamname: string, repoID: string, chatDisabled: boolean) => {
        callAndHandleError(async () => {
          await RPCTypes.gitSetTeamRepoSettingsRpcPromise({
            channelName,
            chatDisabled,
            folder: {
              created: false,
              folderType: RPCTypes.FolderType.team,
              name: teamname,
            },
            repoID,
          })
        })
      },
    }
    return {
      ...initialState,
      dispatch,
    }
  })
)

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
export const makeGitInfo = (i?: Partial<Types.GitInfo>): Types.GitInfo =>
  i ? Object.assign({...emptyInfo}, i) : emptyInfo

export const loadingWaitingKey = 'git:loading'
