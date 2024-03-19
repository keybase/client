import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import type * as T from '@/constants/types'

type Props = {
  members: string[]
  teamID: T.Teams.TeamID
}

const ConfirmKickOut = (props: Props) => {
  const members = props.members
  const teamID = props.teamID
  const [subteamsToo, setSubteamsToo] = React.useState(false)

  const _subteamIDs = C.useTeamsState(s => s.teamDetails.get(teamID)?.subteams) ?? new Set<string>()
  const subteamIDs = Array.from(_subteamIDs)
  const subteams = C.useTeamsState(
    C.useShallow(s => subteamIDs.map(id => C.Teams.getTeamMeta(s, id).teamname))
  )
  const teamname = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID).teamname)
  const waitingKeys = ([] as string[]).concat.apply(
    members.map(member => C.Teams.removeMemberWaitingKey(teamID, member)),
    members.map(member => subteamIDs.map(subteamID => C.Teams.removeMemberWaitingKey(subteamID, member)))
  )
  const waiting = C.Waiting.useAnyWaiting(...waitingKeys)
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])

  const setMemberSelected = C.useTeamsState(s => s.dispatch.setMemberSelected)
  const removeMember = C.useTeamsState(s => s.dispatch.removeMember)
  // TODO(Y2K-1592): do this in one RPC
  const onRemove = () => {
    setMemberSelected(teamID, '', false, true)

    members.forEach(member => removeMember(teamID, member))
    if (subteamsToo) {
      subteamIDs.forEach(subteamID => members.forEach(member => removeMember(subteamID, member)))
    }
  }

  const wasWaiting = Container.usePrevious(waiting)
  const navUpToScreen = C.useRouterState(s => s.dispatch.navUpToScreen)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      navUpToScreen('team')
    }
  }, [navUpToScreen, waiting, wasWaiting])

  const prompt = (
    <Kb.Text center={true} type="Header" style={styles.prompt}>
      Kick {C.Teams.stringifyPeople(members)} out of {teamname}?
    </Kb.Text>
  )
  const header = (
    <Kb.Box style={styles.positionRelative}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Kb.Styles.collapseStyles([
          styles.iconContainer,
          members.length > 5 && styles.iconContainerMany,
        ])}
      >
        <Kb.Icon
          type="iconfont-block"
          color={Kb.Styles.globalColors.white}
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
          {subteams.length !== 0 && (
            <Kb.Checkbox
              checked={subteamsToo}
              onCheck={setSubteamsToo}
              labelComponent={
                <Kb.Text type="Body" style={Kb.Styles.globalStyles.flexOne}>
                  Also kick them out of all subteams: <Kb.Text type="BodyBold">{subteams.join(', ')}</Kb.Text>
                </Kb.Text>
              }
              style={Kb.Styles.globalStyles.fullWidth}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
  headerIcon: Kb.Styles.platformStyles({
    common: {position: 'relative'},
    isElectron: {top: 1},
    isMobile: {right: -0.5, top: 0.5},
  }),
  iconContainer: {
    backgroundColor: Kb.Styles.globalColors.red,
    borderColor: Kb.Styles.globalColors.white,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 3,
    bottom: -3,
    height: 24,
    overflow: 'hidden',
    position: 'absolute',
    right: Kb.Styles.isMobile ? -24 : 0,
    width: 24,
  },
  iconContainerMany: {
    right: Kb.Styles.isMobile ? 0 : 20,
  },
  positionRelative: {
    position: 'relative',
  },
  prompt: Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
}))
