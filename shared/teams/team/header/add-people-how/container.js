// @flow
import * as React from 'react'
import {connect} from '../../../../util/container'
import {AddPeopleHow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  teamname: string,
  visible: boolean,
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => {
  return {
    onAddPeople: () => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
        }
        )
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    },
    onInvite: () => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'inviteByEmail'}],
        }
        )
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    },
  }
}

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(AddPeopleHow)
