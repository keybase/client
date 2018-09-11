// @flow
import {connect, type TypedState} from '../../../../util/container'
import {isTeamWithChosenChannels, getTeamMemberCount} from '../../../../constants/teams'
import {navigateTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  memberCount: getTeamMemberCount(state, teamname),
  teamname,
})

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onClick: () => dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
  badgeSubscribe: stateProps.badgeSubscribe,
  memberCount: stateProps.memberCount,
  teamname: stateProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamHeader)
