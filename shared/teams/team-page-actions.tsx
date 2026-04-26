import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {isMobile} from '@/constants/platform'
import {clearModals, navigateAppend, navigateToInbox, previewConversation} from '@/constants/router'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {addToTeam} from './actions'
import {onTeamCreated} from './create-team-effects'

type UsersToAdd = Array<{assertion: string; role: T.Teams.TeamRoleType}>

type ShowTeamByNameOptions = {
  addMembers?: boolean
  initialTab?: T.Teams.TabKey
  join?: boolean
}

export const createNewTeamAndNavigate = async (
  teamname: string,
  joinSubteam: boolean,
  options?: {fromChat?: boolean; usersToAdd?: UsersToAdd}
) => {
  try {
    const {teamID} = await T.RPCGen.teamsTeamCreateRpcPromise(
      {joinSubteam, name: teamname},
      S.waitingKeyTeamsCreation
    )
    onTeamCreated(teamID)
    if (options?.usersToAdd?.length) {
      addToTeam(teamID, options.usersToAdd, false)
    }

    if (options?.fromChat) {
      clearModals()
      navigateToInbox()
      previewConversation({
        channelname: 'general',
        reason: 'convertAdHoc',
        teamname,
      })
      return
    }

    clearModals()
    navigateAppend({name: 'team', params: {teamID}})
    if (isMobile) {
      navigateAppend({name: 'profileEditAvatar', params: {createdTeam: true, teamID}})
    }
  } catch (error) {
    logger.warn(`Failed to create team "${teamname}"`, error)
    useConfigState.getState().dispatch.setGlobalError(error)
  }
}

export const showTeamByName = async (teamname: string, options?: ShowTeamByNameOptions) => {
  const {addMembers, initialTab, join} = options ?? {}
  let teamID: T.Teams.TeamID
  try {
    teamID = await T.RPCGen.teamsGetTeamIDRpcPromise({teamName: teamname})
  } catch (error) {
    logger.info(`team="${teamname}" cannot be loaded:`, error)
    navigateAppend({name: 'teamExternalTeam', params: {teamname}})
    if (join) {
      navigateAppend({name: 'teamJoinTeamDialog', params: {initialTeamname: teamname}})
    }
    return
  }

  if (addMembers) {
    try {
      const map = await T.RPCGen.teamsGetTeamRoleMapRpcPromise()
      const role = map.teams?.[teamID]?.role || map.teams?.[teamID]?.implicitRole
      if (role !== T.RPCGen.TeamRole.admin && role !== T.RPCGen.TeamRole.owner) {
        logger.info(`ignoring team="${teamname}" with addMember, user is not an admin but role=${role}`)
        return
      }
    } catch (error) {
      logger.info(`team="${teamname}" failed to check if user is an admin:`, error)
      return
    }
  }

  navigateAppend({
    name: 'team',
    params: {teamID, ...(initialTab === undefined ? {} : {initialTab})},
  })
  if (addMembers) {
    navigateAppend({
      name: 'teamsTeamBuilder',
      params: {namespace: 'teams', teamID, title: ''},
    })
  }
}
