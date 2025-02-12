import * as React from 'react'
import * as C from '@/constants'
import * as Container from '@/util/container'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'
import {useTeamDetailsSubscribe} from '../subscriber'
import noop from 'lodash/noop'

type OwnProps = {teamID: T.Teams.TeamID}

const DeleteTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID
  const {teamname} = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const deleteWaiting = C.Waiting.useAnyWaiting(C.Teams.deleteTeamWaitingKey(teamID))
  const teamMetas = C.useTeamsState(s => s.teamMeta)
  const subteamNames = teamDetails?.subteams.size
    ? [...teamDetails.subteams]
        .map(subteamID => teamMetas.get(subteamID)?.teamname ?? '')
        .filter(name => !!name)
    : undefined

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = deleteWaiting ? noop : _onBack
  const deleteTeam = C.useTeamsState(s => s.dispatch.deleteTeam)
  const _onDelete = React.useCallback(() => () => deleteTeam(teamID), [deleteTeam, teamID])
  const onDelete = Container.useSafeSubmit(_onDelete, !deleteWaiting)

  const [checks, setChecks] = React.useState({
    checkChats: false,
    checkFolder: false,
    checkNotify: false,
  })
  const {checkChats, checkFolder, checkNotify} = checks
  const onCheck = (which: keyof typeof checks) => (enable: boolean) => setChecks({...checks, [which]: enable})
  const disabled = !checkChats || !checkFolder || !checkNotify
  const error = C.Waiting.useAnyErrors(C.Teams.deleteTeamWaitingKey(teamID))
  const prevDeleteWaiting = Container.usePrevious(deleteWaiting)
  React.useEffect(() => {
    if (prevDeleteWaiting !== undefined && !deleteWaiting && prevDeleteWaiting && !error) {
      // Finished, nav up
      onBack()
    }
  }, [deleteWaiting, prevDeleteWaiting, onBack, error])

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  React.useEffect(() => {
    return () => {
      dispatchClearWaiting(C.Teams.deleteTeamWaitingKey(teamID))
    }
  }, [dispatchClearWaiting, teamID])
  useTeamDetailsSubscribe(teamID)

  if (subteamNames) {
    return (
      <Kb.ConfirmModal
        content={
          <Kb.Text type="Body" center={true} style={{marginTop: Kb.Styles.globalMargins.medium}}>
            Before you can delete <Kb.Text type="BodySemibold">{teamname}</Kb.Text>, delete its{' '}
            {subteamNames.length} {pluralize('subteam', subteamNames.length)}:{' '}
            <Kb.Text type="BodySemibold">{subteamNames.join(', ')}</Kb.Text>.
          </Kb.Text>
        }
        header={<Header teamname={teamname} />}
        prompt={
          <Kb.Text type="Header" center={true} style={Kb.Styles.padding(0, Kb.Styles.globalMargins.small)}>
            You can't delete {teamname} because it has subteams.
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
      waitingKey={C.Teams.deleteTeamWaitingKey(teamID)}
    />
  )
}

const Header = (props: {teamname: string}) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
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

const Checkboxes = (props: CheckboxesProps) => (
  <Kb.Box2 direction="vertical">
    <Kb.Checkbox
      checked={props.checkChats}
      label="Team chats will be lost"
      onCheck={checked => props.onSetCheckChats(checked)}
    />
    <Kb.Checkbox
      checked={props.checkFolder}
      label="Data in the team folder will be lost"
      onCheck={checked => props.onSetCheckFolder(checked)}
    />
    <Kb.Checkbox
      checked={props.checkNotify}
      label="Team members will be notified"
      onCheck={checked => props.onSetCheckNotify(checked)}
    />
  </Kb.Box2>
)

export default DeleteTeamContainer
