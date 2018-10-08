// @flow
import {connect, type TypedState} from '../../../../util/container'
import {isTeamWithChosenChannels} from '../../../../constants/teams'
import {navigateTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  teamname,
})

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onClick: () => dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeSubscribe: stateProps.badgeSubscribe,
  onClick: dispatchProps.onClick,
  teamname: stateProps.teamname,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(BigTeamHeader)
