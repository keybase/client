// @flow
import * as Constants from '../../constants/git'

const loadGit = (): Constants.LoadGit => ({
  payload: undefined,
  type: 'git:loadGit',
})

const deleteTeamRepo = (teamname: string, name: string, notifyTeam: boolean): Constants.DeleteTeamRepo => ({
  payload: {
    name,
    notifyTeam,
    teamname,
  },
  type: 'git:deleteTeamRepo',
})

const deletePersonalRepo = (name: string): Constants.DeletePersonalRepo => ({
  payload: {name},
  type: 'git:deletePersonalRepo',
})

const createTeamRepo = (teamname: string, name: string, notifyTeam: boolean): Constants.CreateTeamRepo => ({
  payload: {
    name,
    notifyTeam,
    teamname,
  },
  type: 'git:createTeamRepo',
})

const createPersonalRepo = (name: string): Constants.CreatePersonalRepo => ({
  payload: {name},
  type: 'git:createPersonalRepo',
})

const setLoading = (loading: boolean): Constants.SetLoading => ({
  payload: {loading},
  type: 'git:setLoading',
})

const setError = (gitError: ?Error): Constants.SetError => ({
  payload: {gitError},
  type: 'git:setError',
})

const badgeAppForGit = (ids: ?Array<string>): Constants.BadgeAppForGit => ({
  payload: {ids: ids || []},
  type: 'git:badgeAppForGit',
})

export {
  loadGit,
  createTeamRepo,
  createPersonalRepo,
  setLoading,
  deleteTeamRepo,
  deletePersonalRepo,
  setError,
  badgeAppForGit,
}
