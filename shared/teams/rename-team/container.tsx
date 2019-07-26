import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = Container.RouteProps< { teamname: string } >

const mapStateToProps = (state, ownProps) => ({
  error: Container.anyErrors(state, Constants.teamRenameWaitingKey),
  teamname: Container.getRouteProps(ownProps, 'teamname', ''),
  title: 'Rename subteam',
  waiting: Container.anyWaiting(state, Constants.teamRenameWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onRename: (oldName, newName) => dispatch(TeamsGen.createRenameTeam({newName, oldName})),
  onCancel: () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.teamRenameWaitingKey}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onSuccess: teamname => {
    // TODO we wouldn't have to do any of this if team stuff was keyed on the
    // team ID instead of name. Since it's keyed on name, we replace the parent
    // route with one with the newly changed teamname
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname: teamname.toLowerCase()}, selected: 'team'}],
        replace: true,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  // Auto generated from flowToTs. Please clean me!
  error:
    (stateProps.error === null || stateProps.error === undefined ? undefined : stateProps.error.message) ||
    '',
  onCancel: dispatchProps.onCancel,
  onRename: newName => dispatchProps._onRename(stateProps.teamname, newName),
  onSuccess: dispatchProps.onSuccess,
  teamname: stateProps.teamname,
  title: stateProps.title,
  waiting: stateProps.waiting,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'RenameTeam')(
  RenameTeam
)
