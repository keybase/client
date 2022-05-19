import type * as TeamsTypes from '../constants/types/teams'
import type GitRoot from './container'
import type GitDeleteRepo from './delete-repo/container'
import type GitNewRepo from './new-repo/container'
import type GitSelectChannel from './select-channel'

const gitRoot = {getScreen: (): typeof GitRoot => require('./container').default}

export const newRoutes = {
  gitRoot,
}
export const newModalRoutes = {
  gitDeleteRepo: {getScreen: (): typeof GitDeleteRepo => require('./delete-repo/container').default},
  gitNewRepo: {getScreen: (): typeof GitNewRepo => require('./new-repo/container').default},
  gitSelectChannel: {getScreen: (): typeof GitSelectChannel => require('./select-channel').default},
}

// TODO figure out how to enforce this, this works in playground
// type RouteKeys = keyof typeof newRoutes | keyof typeof newModalRoutes

export type RootParamListGit = {
  gitRoot: {expandedSet: Set<string>}
  gitDeleteRepo: {id: string}
  gitNewRepo: {isTeam: boolean}
  gitSelectChannel: {
    teamID: TeamsTypes.TeamID
    repoID: string
    selected: string
  }
}
// type ParamKeys = keyof RootParamList
// export type RootParamListGit = ParamKeys extends RouteKeys ? RootParamList : never
