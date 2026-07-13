import * as React from 'react'
import * as C from '@/constants'
import {useSafeSubmit} from '@/util/safe-submit'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'
import noop from 'lodash/noop'
import {deleteTeam} from './actions'
import {useLoadedTeam} from './team/use-loaded-team'
import {useTeamsList} from './use-teams-list'
import {useNavUpWhenDone} from './common/use-nav-up-when-done'

type OwnProps = {teamID: T.Teams.TeamID}

const DeleteTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID
  const {loading, teamDetails, teamMeta} = useLoadedTeam(teamID)
  const {teams} = useTeamsList()
  const teamname = teamMeta.teamname
  const deleteWaiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsDeleteTeam(teamID))
  const subteamNames = teamDetails.subteams.size
    ? [...teamDetails.subteams]
        .map(subteamID => teams.find(team => team.id === subteamID)?.teamname ?? '')
        .filter(name => !!name)
    : undefined

  const onBack = deleteWaiting ? noop : C.Router2.navigateUp
  const onDelete = useSafeSubmit(() => deleteTeam(teamID), !deleteWaiting)

  const [checks, setChecks] = React.useState({
    checkChats: false,
    checkFolder: false,
    checkNotify: false,
  })
  const {checkChats, checkFolder, checkNotify} = checks
  const onCheck = (which: keyof typeof checks) => (enable: boolean) => setChecks({...checks, [which]: enable})
  const disabled = !checkChats || !checkFolder || !checkNotify
  const error = C.Waiting.useAnyErrors(C.waitingKeyTeamsDeleteTeam(teamID))
  useNavUpWhenDone(deleteWaiting, error)

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  React.useEffect(() => {
    return () => {
      dispatchClearWaiting(C.waitingKeyTeamsDeleteTeam(teamID))
    }
  }, [dispatchClearWaiting, teamID])

  if (loading) {
    return (
      <Kb.ConfirmModal
        header={<Header teamname={teamname} />}
        prompt="Loading team info..."
        content={<Kb.ProgressIndicator type="Large" />}
        onCancel={onBack}
      />
    )
  }

  if (subteamNames) {
    return (
      <Kb.ConfirmModal
        content={
          <Kb.Text type="Body" center={true} style={styles.subteamText}>
            Before you can delete <Kb.Text type="BodySemibold">{teamname}</Kb.Text>, delete its{' '}
            {subteamNames.length} {pluralize('subteam', subteamNames.length)}:{' '}
            <Kb.Text type="BodySemibold">{subteamNames.join(', ')}</Kb.Text>.
          </Kb.Text>
        }
        header={<Header teamname={teamname} />}
        prompt={
          <Kb.Text type="Header" center={true} style={Kb.Styles.padding(0, Kb.Styles.globalMargins.small)}>
            {`You can't delete ${teamname} because it has subteams.`}
          </Kb.Text>
        }
        onCancel={onBack}
      />
    )
  }

  return (
    <Kb.ConfirmModal
      error={error ? error.message : ''}
      confirmText="Delete team"
      content={
        <Checkboxes
          checkChats={checkChats}
          checkFolder={checkFolder}
          checkNotify={checkNotify}
          onSetCheckChats={onCheck('checkChats')}
          onSetCheckFolder={onCheck('checkFolder')}
          onSetCheckNotify={onCheck('checkNotify')}
        />
      }
      description="This cannot be undone. By deleting the team, you agree that:"
      header={<Header teamname={teamname} />}
      onCancel={onBack}
      onConfirm={disabled ? undefined : onDelete}
      prompt={`Delete ${teamname}?`}
      waitingKey={C.waitingKeyTeamsDeleteTeam(teamID)}
    />
  )
}

const Header = (props: {teamname: string}) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.ImageIcon type="icon-team-delete-28" style={styles.deleteIcon} />
  </>
)

type CheckboxesProps = {
  checkChats: boolean
  checkFolder: boolean
  checkNotify: boolean
  onSetCheckChats: (checked: boolean) => void
  onSetCheckFolder: (checked: boolean) => void
  onSetCheckNotify: (checked: boolean) => void
}

const Checkboxes = (props: CheckboxesProps) => {
  const {onSetCheckChats, onSetCheckFolder, onSetCheckNotify} = props
  return (
    <Kb.Box2 direction="vertical">
      <Kb.Checkbox
        checked={props.checkChats}
        label="Team chats will be lost"
        onCheck={checked => onSetCheckChats(checked)}
      />
      <Kb.Checkbox
        checked={props.checkFolder}
        label="Data in the team folder will be lost"
        onCheck={checked => onSetCheckFolder(checked)}
      />
      <Kb.Checkbox
        checked={props.checkNotify}
        label="Team members will be notified"
        onCheck={checked => onSetCheckNotify(checked)}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  deleteIcon: {marginRight: -60, marginTop: -20, zIndex: 1},
  subteamText: {marginTop: Kb.Styles.globalMargins.medium},
}))

export default DeleteTeamContainer
