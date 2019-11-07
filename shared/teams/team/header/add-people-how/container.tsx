import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/teams'
import * as Types from '../../../../constants/types/teams'
import {AddPeopleHow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewTeamBuilder} from '../../../../actions/typed-routes'
import {teamsTab} from '../../../../constants/tabs'
import openURL from '../../../../util/open-url'
import * as Styles from '../../../../styles'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

export default Container.connect(
  (state, {teamID}: OwnProps) => ({teamname: Constants.getTeamNameFromID(state, teamID) || ''}),
  dispatch => {
    return {
      _onAddPeople: (teamname: string) => {
        dispatch(appendNewTeamBuilder(teamname))
      },
      _onInvite: (teamname: string) => {
        const selected = Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {teamname}, selected}],
          })
        )
        dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab]}))
      },
      _onSlackImport: (teamname: string) => openURL(`https://keybase.io/slack-importer/${teamname}`),
    }
  },
  (s, d, o: OwnProps) => ({
    ...s,
    attachTo: o.attachTo,
    onAddPeople: () => d._onAddPeople(s.teamname),
    onHidden: o.onHidden,
    onInvite: () => d._onInvite(s.teamname),
    onSlackImport: () => d._onSlackImport(s.teamname),
    visible: o.visible,
  })
)(AddPeopleHow)
