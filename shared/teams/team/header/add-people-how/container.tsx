import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import openURL from '../../../../util/open-url'
import type * as React from 'react'
import type * as Types from '../../../../constants/types/teams'
import {AddPeopleHow} from '.'
import {appendNewTeamBuilder} from '../../../../actions/typed-routes'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

export default Container.connect(
  (state, {teamID}: OwnProps) => ({teamname: Constants.getTeamNameFromID(state, teamID) || ''}),
  (dispatch, {teamID}) => {
    return {
      _onSlackImport: (teamname: string) => openURL(`https://keybase.io/slack-importer/${teamname}`),
      onAddPeople: () => {
        dispatch(appendNewTeamBuilder(teamID))
      },
      onInvite: () => {
        const selected = Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {teamID}, selected}],
          })
        )
        dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab]}))
      },
    }
  },
  (s, d, o: OwnProps) => ({
    ...s,
    attachTo: o.attachTo,
    onAddPeople: d.onAddPeople,
    onHidden: o.onHidden,
    onInvite: d.onInvite,
    onSlackImport: () => d._onSlackImport(s.teamname),
    visible: o.visible,
  })
)(AddPeopleHow)
