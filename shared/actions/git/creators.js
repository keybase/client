// @flow
import * as Constants from '../../constants/git'
// import * as RPCTypes from '../../constants/types/flow-types'

const loadGit = (): Constants.LoadGit => ({
  payload: undefined,
  type: 'git:loadGit',
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

export {loadGit, createTeamRepo, createPersonalRepo, setLoading}
