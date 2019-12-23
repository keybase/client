import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'

type Props = Container.RouteProps<{
  username: string
  teamID: Types.TeamID
  navToChat?: boolean
}>

const ReallyRemoveMember = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const member = Container.getRouteProps(props, 'username', '')
  const navToChat = Container.getRouteProps(props, 'navToChat', false)

  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID))
  const waitingKey = Constants.removeMemberWaitingKey(teamID, member)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onRemove = () =>
    dispatch(
      TeamsGen.createRemoveMember({
        teamID,
        username: member,
      })
    )

  const onClose = () => dispatch(nav.safeNavigateUpPayload())

  const waiting = Container.useAnyWaiting(waitingKey)
  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      if (navToChat) {
        dispatch(nav.safeNavigateUpPayload())
      } else {
        dispatch(RouteTreeGen.createNavUpToScreen({routeName: 'team'}))
      }
    }
  }, [dispatch, waiting, wasWaiting])

  return (
    <Kb.ConfirmModal
      confirmText={`Yes, remove ${member}`}
      description={`${member} will lose access to all the ${teamname} chats and folders, and they won't be able to get back unless an admin invites them.`}
      header={
        <Kb.Box style={styles.iconContainer}>
          <Kb.Avatar username={member} size={64} />
          <Kb.Box style={styles.icon}>
            <Kb.Icon color={Styles.globalColors.red} type="iconfont-remove" />
          </Kb.Box>
        </Kb.Box>
      }
      onCancel={onClose}
      onConfirm={onRemove}
      prompt={
        <Kb.Text center={true} type={Styles.isMobile ? 'Header' : 'HeaderBig'} style={styles.header}>
          Are you sure you want to remove {member} from {teamname}?
        </Kb.Text>
      }
      waitingKey={waitingKey}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  header: {padding: Styles.globalMargins.small},
  icon: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 100,
      bottom: 0,
      position: 'absolute',
      right: 0,
    },
    isMobile: {
      bottom: -2,
      right: -2,
    },
  }),
  iconContainer: {
    position: 'relative',
  },
}))

export default ReallyRemoveMember
