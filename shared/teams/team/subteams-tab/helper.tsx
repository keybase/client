import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {TypedState} from '../../../util/container'
import Add from './add-row/container'
import Intro from './intro-row/container'
import None from './none-row'
import Team from './team-row/container'

export type OwnProps = {
  teamname: string
}

type StateProps = {
  _sawSubteamsBanner: boolean
  _subteams: I.Set<Types.Teamname>
  _yourOperations: Types.TeamOperations
}

/* Helpers to build the teams tabs. mapStateHelper is called by the master mapStateToProps, getRows makes the rows to be injected below the header, renderItem renders the individual row */
export const mapStateHelper = (state: TypedState, {teamname}: OwnProps): StateProps => ({
  // @ts-ignore getIn
  _sawSubteamsBanner: state.teams.getIn(['sawSubteamsBanner'], false),
  _subteams: Constants.getTeamSubteams(state, teamname),
  _yourOperations: Constants.getCanPerform(state, teamname),
})

export const getRows = ({_subteams, _sawSubteamsBanner, _yourOperations}: StateProps) => {
  const bannerRow = _sawSubteamsBanner ? [] : [{type: 'subteam-intro'}]
  const addMembersRow = _yourOperations.manageSubteams ? [{type: 'subteam-add'}] : []
  const subTeamsRows = _subteams.sort().map(subteam => ({teamname: subteam, type: 'subteam-subteam'}))
  const noSubteamsRow = _subteams.isEmpty() ? [{type: 'subteam-none'}] : []
  return [...bannerRow, ...addMembersRow, ...subTeamsRows, ...noSubteamsRow]
}

export const renderItem = (
  teamname: string,
  row: {
    teamname: string
    type: string
  }
) => {
  switch (row.type) {
    case 'subteam-intro':
      return <Intro key="subteam-intro" teamname={teamname} />
    case 'subteam-add':
      return <Add key="subteam-add" teamname={teamname} />
    case 'subteam-none':
      return <None key="subteam-none" />
    case 'subteam-subteam':
      // @ts-ignore doesn't seem to understand connect here
      return <Team key={row.teamname} teamname={row.teamname} />
    default:
      return null
  }
}
