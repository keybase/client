// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import Add from './add-row/container'
import Intro from './intro-row/container'
import None from './none-row'
import Team from './team-row/container'

export type OwnProps = {
  teamname: string,
}

export const mapStateHelper = (state: TypedState, {teamname}) => ({
  _sawSubteamsBanner: state.teams.getIn(['sawSubteamsBanner'], false),
  _subteams: Constants.getTeamSubteams(state, teamname),
  _yourOperations: Constants.getCanPerform(state, teamname),
})

export const getRows = ({_subteams, _sawSubteamsBanner, _yourOperations}) => {
  const subteams = _subteams.sort()
  const noSubteams = subteams.isEmpty()
  return [
    ...(!_sawSubteamsBanner ? [{type: 'subteam-intro'}] : []),
    ...(_yourOperations.manageSubteams ? [{type: 'subteam-add'}] : []),
    ...subteams.map(subteam => ({teamname: subteam, type: 'subteam-subteam'})),
    ...(noSubteams ? [{type: 'subteam-none'}] : []),
  ]
}

export const renderItem = (teamname, row) => {
  switch (row.type) {
    case 'subteam-intro':
      return <Intro key="subteam-intro" teamname={teamname} />
    case 'subteam-add':
      return <Add key="subteam-add" teamname={teamname} />
    case 'subteam-none':
      return <None key="subteam-none" />
    case 'subteam-subteam':
      return <Team key={row.teamname} teamname={row.teamname} />
    default:
      return null
  }
}
