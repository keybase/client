import * as T from '@/constants/types'
import * as dateFns from 'date-fns'

export const parseRepoResult = (result: T.RPCGen.GitRepoResult): T.Git.GitInfo | undefined => {
  if (result.state === T.RPCGen.GitRepoResultState.ok) {
    const r: T.RPCGen.GitRepoInfo = result.ok
    if (r.folder.folderType === T.RPCGen.FolderType.public) {
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

export const parseRepoError = (result: T.RPCGen.GitRepoResult): Error => {
  let errStr = 'unknown'
  if (result.state === T.RPCGen.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

export const parseRepos = (results: ReadonlyArray<T.RPCGen.GitRepoResult>) => {
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

export const findExpandedRepoID = (
  repos: ReadonlyMap<string, T.Git.GitInfo>,
  repoID?: string,
  teamname?: string
) => {
  if (!repoID || !teamname) {
    return undefined
  }
  for (const [id, info] of repos) {
    if (info.repoID === repoID && info.teamname === teamname) {
      return id
    }
  }
  return undefined
}
