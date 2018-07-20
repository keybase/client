// @flow
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import NewRepo from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'
import {getSortedTeamnames} from '../../constants/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  teams: getSortedTeamnames(state),
  error: Constants.getError(state),
  isTeam: routeProps.get('isTeam'),
  waitingKey: Constants.loadingWaitingKey,
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => {
    const createAction =
      routeProps.get('isTeam') && teamname
        ? GitGen.createCreateTeamRepo({teamname, name, notifyTeam})
        : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
  },
  onNewTeam: () => dispatch(navigateTo([teamsTab, 'showNewTeamDialog'])),
})

export default connect(mapStateToProps, mapDispatchToProps)(NewRepo)
