import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {
  members: string[]
  teamID: T.Teams.TeamID
}

const ConfirmKickOut = (props: Props) => {
  const {members, teamID} = props
  const [subteamsToo, setSubteamsToo] = React.useState(false)

  const [kickedVisible, setKickedVisible] = React.useState(false)

  const _subteamIDs = useTeamsState(s => s.teamDetails.get(teamID)?.subteams) ?? new Set<string>()
  const subteamIDs = Array.from(_subteamIDs)
  const subteams = useTeamsState(
    C.useShallow(s => subteamIDs.map(id => Teams.getTeamMeta(s, id).teamname))
  )
  const teamname = useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const waitingKeys = ([] as string[]).concat.apply(
    members.map(member => C.waitingKeyTeamsRemoveMember(teamID, member)),
    members.map(member => subteamIDs.map(subteamID => C.waitingKeyTeamsRemoveMember(subteamID, member)))
  )
  const waiting = C.Waiting.useAnyWaiting(...waitingKeys)
  const nav = useSafeNavigation()
  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])

  const setMemberSelected = useTeamsState(s => s.dispatch.setMemberSelected)
  const removeMember = useTeamsState(s => s.dispatch.removeMember)
  const loadTeam = useTeamsState(s => s.dispatch.loadTeam)
  // TODO(Y2K-1592): do this in one RPC
  const onRemove = () => {
    setMemberSelected(teamID, '', false, true)

    members.forEach(member => removeMember(teamID, member))
    if (subteamsToo) {
      subteamIDs.forEach(subteamID => members.forEach(member => removeMember(subteamID, member)))
    }
    loadTeam(teamID)
  }

  const wasWaitingRef = React.useRef(waiting)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  React.useEffect(() => {
    if (wasWaitingRef.current && !waiting) {
      setKickedVisible(true)
      setTimeout(() => {
        navigateUp()
      }, 1000)
    }
    if (wasWaitingRef.current !== waiting) {
      wasWaitingRef.current = waiting
    }
  }, [navigateUp, waiting])

  const prompt = (
    <Kb.Text center={true} type="Header" style={styles.prompt}>
      Kick {Teams.stringifyPeople(members)} out of {teamname}?
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
          <Kb.SimpleToast visible={kickedVisible} text="Kicked" iconType="iconfont-check" />
        </Kb.Box2>
      }
      onCancel={onCancel}
      onConfirm={kickedVisible ? undefined : onRemove}
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
