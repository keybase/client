import * as React from 'react'
import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {useSafeSubmit} from '@/util/safe-submit'
import type * as T from '@/constants/types'
import {useTeamsSubscribe, useTeamDetailsSubscribeMountOnly} from '@/teams/subscriber'
import LastOwnerDialog from './last-owner'

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
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.iconContainer}>
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
  useTeamsSubscribe()
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
        overflow: 'hidden',
        width: 24,
        zIndex: 1,
      },
      prompt: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
      spinnerContainer: {
        alignItems: 'center',
        flex: 1,
        padding: Kb.Styles.globalMargins.xlarge,
      },
      spinnerProgressIndicator: {
        width: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

type OwnProps = {teamID: T.Teams.TeamID}

const ReallyLeaveTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID
  const {teamname} = useTeamsState(s => Teams.getTeamMeta(s, teamID))
  const {settings, members} = useTeamsState(s => s.teamDetails.get(teamID) ?? Teams.emptyTeamDetails)
  const open = settings.open
  const lastOwner = useTeamsState(s => Teams.isLastOwner(s, teamID))
  const stillLoadingTeam = !members
  const leaving = C.Waiting.useAnyWaiting(C.waitingKeyTeamsLeaveTeam(teamname))
  const error = C.Waiting.useAnyErrors(C.waitingKeyTeamsLeaveTeam(teamname))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDeleteTeam = React.useCallback(() => {
    navigateUp()
    navigateAppend({props: {teamID}, selected: 'teamDeleteTeam'})
  }, [navigateUp, navigateAppend, teamID])
  const leaveTeam = useTeamsState(s => s.dispatch.leaveTeam)
  const _onLeave = React.useCallback(
    (permanent: boolean) => {
      leaveTeam(teamname, permanent, 'teams')
    },
    [leaveTeam, teamname]
  )
  const _onBack = navigateUp
  const onBack = leaving ? () => {} : _onBack
  const onLeave = useSafeSubmit(_onLeave, !leaving)

  useTeamDetailsSubscribeMountOnly(teamID)
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
