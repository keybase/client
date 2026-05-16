import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useSafeSubmit} from '@/util/safe-submit'
import * as T from '@/constants/types'
import LastOwnerDialog from './last-owner'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

export type Props = {
  error: string
  onBack: () => void
  onDeleteTeam: () => void
  onLeave: (perm: boolean) => void
  name: string
  open?: boolean
}

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.name} size={64} />
    <Kb.Box2 direction="horizontal" centerChildren={true} overflow="hidden" style={styles.iconContainer}>
      <Kb.Icon
        type="iconfont-leave"
        color={Kb.Styles.globalColors.white}
        fontSize={14}
        style={styles.headerIcon}
      />
    </Kb.Box2>
  </>
)

const ReallyLeaveTeam = (props: Props) => {
  const {name} = props
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  React.useEffect(
    () => () => {
      dispatchClearWaiting(C.waitingKeyTeamsLeaveTeam(name))
    },
    [dispatchClearWaiting, name]
  )
  const [leavePermanently, setLeavePermanently] = React.useState(false)
  const onLeave = () => props.onLeave(leavePermanently)
  return (
    <Kb.ConfirmModal
      error={props.error}
      confirmText="Leave team"
      content={
        <Kb.Checkbox
          label="Block this team"
          labelSubtitle="Future attempts by admins to add you to the team will be ignored."
          onCheck={setLeavePermanently}
          checked={leavePermanently}
          style={styles.checkBox}
        />
      }
      description={`You will lose access to all the team chats and folders${
        !props.open ? ', and you won’t be able to get back unless an admin invites you' : ''
      }.`}
      header={<Header {...props} />}
      onCancel={props.onBack}
      onConfirm={onLeave}
      prompt={
        <Kb.Text type="Header" center={true} style={styles.prompt}>
          Leave {props.name}?
        </Kb.Text>
      }
      waitingKey={C.waitingKeyTeamsLeaveTeam(props.name)}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      checkBox: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.small,
        },
        isElectron: {
          marginLeft: 48,
          marginRight: 48,
        },
        isMobile: {
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
          marginTop: 12,
        },
      }),
      headerIcon: {
        position: 'relative',
        top: 1,
      },
      iconContainer: {
        backgroundColor: Kb.Styles.globalColors.red,
        borderColor: Kb.Styles.globalColors.white,
        borderRadius: 12,
        borderStyle: 'solid',
        borderWidth: 3,
        height: 24,
        marginRight: -46,
        marginTop: -20,
        width: 24,
        zIndex: 1,
      },
      prompt: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
    }) as const
)

type OwnProps = {teamID: T.Teams.TeamID}

const ReallyLeaveTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID
  const {loading, teamDetails, teamMeta} = useLoadedTeam(teamID)
  const teamname = teamMeta.teamname
  const open = teamDetails.settings.open
  const lastOwner =
    teamMeta.role === 'owner' && [...teamDetails.members.values()].filter(member => member.type === 'owner').length < 2
  const leaveTeamRPC = C.useRPC(T.RPCGen.teamsTeamLeaveRpcPromise)
  const stillLoadingTeam = loading
  const waitingKey = C.waitingKeyTeamsLeaveTeam(teamname)
  const leaving = C.Waiting.useAnyWaiting(waitingKey)
  const error = C.Waiting.useAnyErrors(waitingKey)
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const navUpToScreen = C.Router2.navUpToScreen
  const clearModals = C.Router2.clearModals
  const onDeleteTeam = () => {
    navigateUp()
    navigateAppend({name: 'teamDeleteTeam', params: {teamID}})
  }
  const _onLeave = (permanent: boolean) => {
    if (!teamname) {
      return
    }
    leaveTeamRPC(
      [{name: teamname, permanent}, waitingKey],
      () => {
        clearModals()
        navUpToScreen('teamsRoot')
      },
      () => {}
    )
  }
  const _onBack = navigateUp
  const onBack = leaving ? () => {} : _onBack
  const onLeave = useSafeSubmit(_onLeave, !leaving && !loading && !!teamname)

  return lastOwner ? (
    <LastOwnerDialog
      onBack={onBack}
      onDeleteTeam={onDeleteTeam}
      name={teamname}
      stillLoadingTeam={stillLoadingTeam}
    />
  ) : (
    <ReallyLeaveTeam
      error={error?.message ?? ''}
      onBack={onBack}
      onDeleteTeam={onDeleteTeam}
      onLeave={onLeave}
      open={open}
      name={teamname}
    />
  )
}

export default ReallyLeaveTeamContainer
