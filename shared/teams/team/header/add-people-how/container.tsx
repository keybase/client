import * as React from 'react'
import * as Container from '../../../../util/container'
import {AddPeopleHow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewTeamBuilder} from '../../../../actions/typed-routes'
import {teamsTab} from '../../../../constants/tabs'
import openURL from '../../../../util/open-url'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamname: string
  visible: boolean
}

export default Container.connectDEBUG(
  () => ({}),
  (dispatch, {teamname}: OwnProps) => {
    return {
      onAddPeople: () => {
        dispatch(appendNewTeamBuilder(teamname))
      },
      onInvite: () => {
        dispatch(
          RouteTreeGen.createNavigateTo({
            parentPath: [teamsTab],
            path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'teamInviteByEmail'}],
          })
        )
        dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
      },
      onSlackImport: () => openURL(`https://keybase.io/slack-importer/${teamname}`),
    }
  },
  (s, d, o: OwnProps) => ({...s, ...d, attachTo: o.attachTo, visible: o.visible, onHidden: o.onHidden})
)(AddPeopleHow)
