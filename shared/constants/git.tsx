import type * as Types from './types/git'
import * as dateFns from 'date-fns'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Tabs from './tabs'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {logError} from '../util/errors'

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

const clearNavBadges = async () => {
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
  } catch (e) {
    return logError(e)
  }
}

const initialState: Types.State = {
  error: undefined,
  idToInfo: new Map(),
  isNew: new Set(),
}

type ZState = Types.State & {
  dispatchSetError: (err?: Error) => void
  dispatchClearBadges: () => void
  dispatchLoad: () => void
  dispatchSetBadges: (set: Set<string>) => void
  dispatchReset: () => void
  dispatchCreatePersonalRepo: (name: string) => void
  dispatchCreateTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => void
  dispatchDeletePersonalRepo: (repoName: string) => void
  dispatchDeleteTeamRepo: (repoName: string, teamname: string, notifyTeam: boolean) => void
  dispatchNavigateToTeamRepo: (teamname: string, repoID: string) => void
  dispatchSetTeamRepoSettings: (
    channelName: string,
    teamname: string,
    repoID: string,
    chatDisabled: boolean
  ) => void
}

export const useGitState = Container.createZustand(
  Container.immerZustand<ZState>((set, get) => {
    const reduxDispatch = Container.getReduxDispatch()

    const callAndHandleError = (f: () => Promise<void>) => {
      const wrapper = async () => {
        try {
          await f()
          dispatchLoad()
        } catch (error) {
          set(s => {
            s.error = error as Error
          })
        }
      }
      Container.ignorePromise(wrapper())
    }

    const dispatchSetError = (err?: Error) => {
      set(s => {
        s.error = err
      })
    }

    const dispatchNavigateToTeamRepo = (teamname: string, repoID: string) => {
      const f = async () => {
        await _dispatchLoad()
        for (const [, info] of get().idToInfo) {
          if (info.repoID === repoID && info.teamname === teamname) {
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [Tabs.gitTab, {props: {expandedSet: new Set([info.id])}, selected: 'gitRoot'}],
              })
            )
            break
          }
        }
      }
      Container.ignorePromise(f())
    }

    const dispatchSetTeamRepoSettings = (
      channelName: string,
      teamname: string,
      repoID: string,
      chatDisabled: boolean
    ) => {
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
    }

    const dispatchDeletePersonalRepo = (repoName: string) => {
      callAndHandleError(async () => {
        await RPCTypes.gitDeletePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
      })
    }

    const dispatchDeleteTeamRepo = (repoName: string, teamname: string, notifyTeam: boolean) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await RPCTypes.gitDeleteTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
      })
    }

    const dispatchCreatePersonalRepo = (repoName: string) => {
      callAndHandleError(async () => {
        await RPCTypes.gitCreatePersonalRepoRpcPromise({repoName}, loadingWaitingKey)
      })
    }
    const dispatchCreateTeamRepo = (repoName: string, teamname: string, notifyTeam: boolean) => {
      callAndHandleError(async () => {
        const teamName = {parts: teamname.split('.')}
        await RPCTypes.gitCreateTeamRepoRpcPromise({notifyTeam, repoName, teamName}, loadingWaitingKey)
      })
    }

    const dispatchClearBadges = () => {
      set(s => {
        s.isNew = undefined
      })
    }

    const _dispatchLoad = async () => {
      await clearNavBadges()
      const results = await RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, loadingWaitingKey)
      const {errors, repos} = parseRepos(results || [])
      errors.forEach(globalError => reduxDispatch(ConfigGen.createGlobalError({globalError})))
      set(s => {
        s.idToInfo = repos
      })
    }

    const dispatchLoad = () => {
      Container.ignorePromise(_dispatchLoad())
    }

    const dispatchReset = () => {
      set(() => initialState)
    }
    const dispatchSetBadges = (b: Set<string>) => {
      set(s => {
        s.isNew = b
      })
    }
    return {
      ...initialState,
      dispatchClearBadges,
      dispatchCreatePersonalRepo,
      dispatchCreateTeamRepo,
      dispatchDeletePersonalRepo,
      dispatchDeleteTeamRepo,
      dispatchLoad,
      dispatchNavigateToTeamRepo,
      dispatchReset,
      dispatchSetBadges,
      dispatchSetError,
      dispatchSetTeamRepoSettings,
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
