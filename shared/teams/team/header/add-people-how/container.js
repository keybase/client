// @flow
import * as React from 'react'
import {connect} from '../../../../util/container'
import {AddPeopleHow} from '.'
import {navigateTo, switchTo} from '../../../../actions/route-tree'
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
        navigateTo(
          [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
    onInvite: () => {
      dispatch(
        navigateTo(
          [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'inviteByEmail'}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
  }
}

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(AddPeopleHow)
