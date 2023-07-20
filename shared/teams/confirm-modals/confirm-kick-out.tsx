import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/teams'
import {memoize} from '../../util/memoize'

type Props = {
  members: string[]
  teamID: Types.TeamID
}

const getSubteamNames = memoize(
  (state: Constants.State, teamID: Types.TeamID): [string[], Types.TeamID[]] => {
    const subteamIDs = [...(Constants.useState.getState().teamDetails.get(teamID)?.subteams ?? [])]
    return [subteamIDs.map(id => Constants.getTeamMeta(state, id).teamname), subteamIDs]
  }
)

const ConfirmKickOut = (props: Props) => {
  const members = props.members
  const teamID = props.teamID ?? Types.noTeamID
  const [subteamsToo, setSubteamsToo] = React.useState(false)

  const [subteams, subteamIDs] = Constants.useState(s => getSubteamNames(s, teamID))
  const teamname = Constants.useState(s => Constants.getTeamMeta(s, teamID).teamname)
  const waitingKeys = ([] as string[]).concat.apply(
    members.map(member => Constants.removeMemberWaitingKey(teamID, member)),
    members.map(member => subteamIDs.map(subteamID => Constants.removeMemberWaitingKey(subteamID, member)))
  )
  const waiting = Container.useAnyWaiting(...waitingKeys)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  const setMemberSelected = Constants.useState(s => s.dispatch.setMemberSelected)
  const removeMember = Constants.useState(s => s.dispatch.removeMember)
  // TODO(Y2K-1592): do this in one RPC
  const onRemove = () => {
    setMemberSelected(teamID, '', false, true)

    members.forEach(member => removeMember(teamID, member))
    if (subteamsToo) {
      subteamIDs.forEach(subteamID => members.forEach(member => removeMember(subteamID, member)))
    }
  }

  const wasWaiting = Container.usePrevious(waiting)
  const navUpToScreen = RouterConstants.useState(s => s.dispatch.navUpToScreen)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      navUpToScreen('team')
    }
  }, [navUpToScreen, waiting, wasWaiting])

  const prompt = (
    <Kb.Text center={true} type="Header" style={styles.prompt}>
      Kick {Constants.stringifyPeople(members)} out of {teamname}?
    </Kb.Text>
  )
  const header = (
    <Kb.Box style={styles.positionRelative}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Styles.collapseStyles([styles.iconContainer, members.length > 5 && styles.iconContainerMany])}
      >
        <Kb.Icon
          type="iconfont-block"
          color={Styles.globalColors.white}
          fontSize={14}
          style={styles.headerIcon}
        />
      </Kb.Box2>
    </Kb.Box>
  )
  return (
    <Kb.ConfirmModal
      header={header}
      prompt={prompt}
      content={
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
          <Kb.Text type="Body" center={true}>
            They will lose access to all the team chats and folders, and they won’t be able to get back unless
            an admin invites them.
          </Kb.Text>
          {subteams.length != 0 && (
            <Kb.Checkbox
              checked={subteamsToo}
              onCheck={setSubteamsToo}
              labelComponent={
                <Kb.Text type="Body" style={Styles.globalStyles.flexOne}>
                  Also kick them out of all subteams: <Kb.Text type="BodyBold">{subteams.join(', ')}</Kb.Text>
                </Kb.Text>
              }
              style={Styles.globalStyles.fullWidth}
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
  container: Styles.padding(0, Styles.globalMargins.small),
  headerIcon: Styles.platformStyles({
    common: {position: 'relative'},
    isElectron: {top: 1},
    isMobile: {right: -0.5, top: 0.5},
  }),
  iconContainer: {
    backgroundColor: Styles.globalColors.red,
    borderColor: Styles.globalColors.white,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 3,
    bottom: -3,
    height: 24,
    overflow: 'hidden',
    position: 'absolute',
    right: Styles.isMobile ? -24 : 0,
    width: 24,
  },
  iconContainerMany: {
    right: Styles.isMobile ? 0 : 20,
  },
  positionRelative: {
    position: 'relative',
  },
  prompt: Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
}))
