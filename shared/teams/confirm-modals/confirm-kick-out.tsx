import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {memoize} from '../../util/memoize'

type Props = Container.RouteProps<{members: string[]; teamID: Types.TeamID}>

const membersStr = (members: string[]): string => {
  switch (members.length) {
    case 0:
      return 'nobody'
    case 1:
      return members[0]
    case 2:
      return `${members[0]} and ${members[1]}`
    case 3:
      return `${members[0]}, ${members[1]} and ${members[2]}`
    default:
      return `${members[0]}, ${members[1]}, and ${members.length - 2} others`
  }
}

const getSubteamNames = memoize((state: Container.TypedState, teamID: Types.TeamID): [
  string[],
  Types.TeamID[]
] => {
  const subteamIDs = [...Constants.getTeamDetails(state, teamID).subteams]
  return [subteamIDs.map(id => Constants.getTeamMeta(state, id).teamname), subteamIDs]
})

const ConfirmKickOut = (props: Props) => {
  const members = Container.getRouteProps(props, 'members', [])
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const [subteamsToo, setSubteamsToo] = React.useState(false)

  const [subteams, subteamIDs] = Container.useSelector(state => getSubteamNames(state, teamID))
  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)
  const waitingKeys = ([] as string[]).concat.apply(
    members.map(member => Constants.removeMemberWaitingKey(teamID, member)),
    members.map(member => subteamIDs.map(subteamID => Constants.removeMemberWaitingKey(subteamID, member)))
  )
  const waiting = Container.useAnyWaiting(...waitingKeys)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  // TODO(Y2K-1592): do this in one RPC
  const onRemove = () => {
    members.forEach(member =>
      dispatch(
        TeamsGen.createRemoveMember({
          teamID,
          username: member,
        })
      )
    )
    if (subteamsToo) {
      subteamIDs.forEach(subteamID =>
        members.forEach(member =>
          dispatch(TeamsGen.createRemoveMember({teamID: subteamID, username: member}))
        )
      )
    }
  }

  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      onCancel()
    }
  }, [waiting, wasWaiting, onCancel])

  const prompt = `Kick ${membersStr(members)} out of ${teamname}?`
  const header = (
    <Kb.Box style={styles.positionRelative}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Icon
        boxStyle={members.length <= 5 ? styles.iconContainerSingle : styles.iconContainer}
        type="iconfont-block"
        style={styles.headerIcon}
        sizeType="Small"
      />
    </Kb.Box>
  )
  return (
    <Kb.ConfirmModal
      header={header}
      prompt={prompt}
      content={
        <Kb.Box2 direction="vertical" gap="small">
          <Kb.Text type="Body">
            They will lose access to all the {teamname} chats and folders, and they won’t be able to get back
            unless an admin invites them.
          </Kb.Text>
          {!!subteams.length && (
            <Kb.Checkbox
              checked={subteamsToo}
              onCheck={setSubteamsToo}
              labelComponent={
                <Kb.Text type="Body">
                  Also kick them out of all {teamname} subteams:{' '}
                  <Kb.Text type="BodyBold">{subteams.join(', ')}</Kb.Text>
                </Kb.Text>
              }
            />
          )}
        </Kb.Box2>
      }
      onCancel={onCancel}
      onConfirm={onRemove}
      confirmText="Kick out"
      waitingKey={waitingKeys}
    />
  )
}
export default ConfirmKickOut

const styles = Styles.styleSheetCreate(() => ({
  headerIcon: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.red,
      borderColor: Styles.globalColors.white,
      borderStyle: 'solid',
      borderWidth: 3,
      color: Styles.globalColors.white,
      padding: 3,
    },
    isElectron: {
      backgroundClip: 'padding-box',
      borderRadius: 50,
    },
    isMobile: {
      borderRadius: 18,
      marginRight: -20,
      marginTop: -30,
    },
  }),
  iconContainer: {
    bottom: -3,
    position: 'absolute',
    right: 20,
  },
  iconContainerSingle: {
    bottom: -3,
    position: 'absolute',
    right: 0,
  },
  positionRelative: {
    position: 'relative',
  },
}))
