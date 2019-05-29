import * as React from 'react'
import {connect} from '../../../../util/container'
import {AddPeopleHow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import openURL from '../../../../util/open-url'

type OwnProps = {
  attachTo: () => React.Component<any> | null
  onHidden: () => void
  teamname: string
  visible: boolean
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => {
  return {
    onAddPeople: () => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'teamAddPeople'}],
        })
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
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
}

export default connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(AddPeopleHow)
