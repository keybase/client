import type * as TeamsTypes from '../constants/types/teams'
import type GitRoot from '.'
import type GitDeleteRepo from './delete-repo'
import type GitNewRepo from './new-repo'
import type GitSelectChannel from './select-channel'

const gitRoot = {
  getOptions: () => require('.').options,
  getScreen: (): typeof GitRoot => require('.').default,
}

export const newRoutes = {
  gitRoot,
}
export const newModalRoutes = {
  gitDeleteRepo: {getScreen: (): typeof GitDeleteRepo => require('./delete-repo').default},
  gitNewRepo: {getScreen: (): typeof GitNewRepo => require('./new-repo').default},
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
