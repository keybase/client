// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import {TeamMemberRow} from '.'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  username: string,
  teamname: string,
  active: boolean,
}

const getFollowing = (state, username: string) => {
  const followingMap = Constants.getFollowingMap(state)
  return !!followingMap[username]
}

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  _members: I.Set<Types.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {teamname, username, active}: OwnProps): StateProps => ({
  following: getFollowing(state, username),
  you: state.config.username,
  active,
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
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

export const ConnectedMemberRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedMemberRow key={props.username} {...props} />
}
