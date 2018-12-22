// @flow
import {connect} from '../../../../util/container'
import {isTeamWithChosenChannels} from '../../../../constants/teams'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'

type OwnProps = {|
  teamname: string,
|}

const mapStateToProps = (state, {teamname}) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  teamname,
})

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onClick: () =>
    dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, {props: {teamname}, selected: 'team'}]})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  badgeSubscribe: stateProps.badgeSubscribe,
  onClick: dispatchProps.onClick,
  teamname: stateProps.teamname,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(BigTeamHeader)
