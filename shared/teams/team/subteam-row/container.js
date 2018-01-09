// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {TeamRow} from '../../main/team-list'
import {amIFollowing} from '../../../constants/selectors'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  teamname: string,
}

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  _members: I.Set<Types.MemberInfo>,
  youCanManageMembers: boolean,
}

const mapStateToProps = (
  state: TypedState,
  {teamname}: OwnProps
): StateProps => ({
  members: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
})

type DispatchProps = {
  onClick: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps): DispatchProps => ({
  onClick: () =>
    dispatch(
      navigateAppend([
        {
          selected: 'member',
          props: ownProps,
        },
      ])
    ),

})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
  }
}

const ConnectedTeamRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedTeamRow key={props.teamname} {...props} />
}
