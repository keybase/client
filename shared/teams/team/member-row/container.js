// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {TeamMemberRow} from '.'
import {amIFollowing} from '../../../constants/selectors'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  active: boolean,
  fullName: string,
  username: string,
  teamname: string,
}

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  _members: I.Set<Types.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {active, fullName, teamname, username}: OwnProps): StateProps => ({
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  active,
  following: amIFollowing(state, username),
  fullName: state.config.username === username ? "You" : fullName,
  you: state.config.username,
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
  const user =
    stateProps._members && stateProps._members.find(member => member.username === ownProps.username)
  const type = user ? user.type : null
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    type,
  }
}

const ConnectedMemberRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedMemberRow key={props.username} {...props} />
}
