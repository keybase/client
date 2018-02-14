// @flow
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import * as GregorGen from '../../../actions/gregor-gen'
import openURL from '../../../util/open-url'
import {navigateAppend} from '../../../actions/route-tree'
import {type TypedState, connect} from '../../../util/container'
import {Subteams} from '.'

export type OwnProps = {
  teamname: Types.Teamname,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  _subteams: state.entities.getIn(['teams', 'teamNameToSubteams', teamname], I.Set()),
  sawSubteamsBanner: state.entities.getIn(['teams', 'sawSubteamsBanner'], false),
  yourOperations: Constants.getCanPerform(state, teamname),
})

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(navigateAppend([{props: {name: `${teamname}.`}, selected: 'showNewTeamDialog'}])),
  onHideSubteamsBanner: () =>
    dispatch(GregorGen.createInjectItem({body: 'true', category: 'sawSubteamsBanner'})),
  onReadMoreAboutSubteams: () => openURL('https://keybase.io/docs/teams/design'),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
  ...ownProps,
  sawSubteamsBanner: stateProps.sawSubteamsBanner,
  subteams: stateProps._subteams.sort(),
  yourOperations: stateProps.yourOperations,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Subteams)
