import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/git'
import DeleteRepo, {type Props} from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<'gitDeleteRepo'>

const NullWrapper = (props: Props) => (props.name ? <DeleteRepo {...props} /> : null)

export default (ownProps: OwnProps) => {
  const gitMap = Container.useSelector(state => Constants.getIdToGit(state))
  const id = ownProps.route.params?.id ?? ''
  const git = gitMap.get(id) || Constants.makeGitInfo()
  const error = Container.useSelector(state => Constants.getError(state))
  const name = git.name || ''
  const teamname = git.teamname || ''
  const waitingKey = Constants.loadingWaitingKey

  const dispatch = Container.useDispatch()
  const _onDelete = (teamname: string | null, name: string, notifyTeam: boolean) => {
    const deleteAction = teamname
      ? GitGen.createDeleteTeamRepo({name, notifyTeam, teamname})
      : GitGen.createDeletePersonalRepo({name})
    dispatch(deleteAction)
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    error,
    name,
    onClose,
    onDelete: (notifyTeam: boolean) => _onDelete(teamname, name, notifyTeam),
    teamname,
    waitingKey,
  }
  return <NullWrapper {...props} />
}
