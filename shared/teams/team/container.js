// @flow
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'
import {HeaderHoc} from '../../common-adapters'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import Team from '.'

import type {TypedState} from '../../constants/reducer'

type StateProps = {
  _memberInfo: I.Set<Constants.MemberInfo>,
  name: Constants.Teamname,
  you: ?string,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => ({
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', routeProps.teamname], I.Set()),
  name: routeProps.teamname,
  you: state.config.username,
})

type DispatchProps = {
  _loadTeam: (teamname: Constants.Teamname) => void,
  onBack: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}): DispatchProps => ({
  _loadTeam: (teamname: Constants.Teamname) => dispatch(Creators.getDetails(teamname)),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  headerStyle: {borderBottomWidth: 0},
  members: stateProps._memberInfo.toJS().sort((a, b) => a.username.localeCompare(b.username)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.name)
    },
  }),
  HeaderHoc
)(Team)
