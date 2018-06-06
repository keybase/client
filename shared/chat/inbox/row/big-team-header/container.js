// @flow
import {connect, type TypedState} from '../../../../util/container'
import {isTeamWithChosenChannels, getTeamMemberCount} from '../../../../constants/teams'
import {BigTeamHeader} from '.'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  memberCount: getTeamMemberCount(state, teamname),
  teamname,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
  badgeSubscribe: stateProps.badgeSubscribe,
  memberCount: stateProps.memberCount,
  teamname: stateProps.teamname,
})

export default connect(
  mapStateToProps,
  () => ({}),
  mergeProps
)(BigTeamHeader)
