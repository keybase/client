import * as React from 'react'
import * as Styles from '../../styles'
import * as WaitingGen from '../../actions/waiting-gen'
import * as Constants from '../../constants/teams'
import type * as Types from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import {pluralize} from '../../util/string'
import {useTeamDetailsSubscribe} from '../subscriber'

export type Props = {
  deleteWaiting: boolean
  onBack: () => void
  onDelete: () => void
  subteamNames?: Array<string>
  teamID: Types.TeamID
  teamname: string
}

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
  </>
)

export type CheckboxesProps = {
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

const ReallyDeleteTeam = (props: Props) => {
  const [checks, setChecks] = React.useState({
    checkChats: false,
    checkFolder: false,
    checkNotify: false,
  })
  const {checkChats, checkFolder, checkNotify} = checks
  const onCheck = (which: keyof typeof checks) => (enable: boolean) => setChecks({...checks, [which]: enable})
  const disabled = !checkChats || !checkFolder || !checkNotify
  const {deleteWaiting, onBack, teamID} = props
  const error = Container.useAnyErrors(Constants.deleteTeamWaitingKey(props.teamID))
  const prevDeleteWaiting = Container.usePrevious(deleteWaiting)
  React.useEffect(() => {
    if (prevDeleteWaiting !== undefined && !deleteWaiting && prevDeleteWaiting && !error) {
      // Finished, nav up
      onBack()
    }
  }, [deleteWaiting, prevDeleteWaiting, onBack, error])

  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    return () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.deleteTeamWaitingKey(teamID)}))
    }
  }, [dispatch, teamID])
  useTeamDetailsSubscribe(teamID)

  if (props.subteamNames) {
    return (
      <Kb.ConfirmModal
        content={
          <Kb.Text type="Body" center={true} style={{marginTop: Styles.globalMargins.medium}}>
            Before you can delete <Kb.Text type="BodySemibold">{props.teamname}</Kb.Text>, delete its{' '}
            {props.subteamNames.length} {pluralize('subteam', props.subteamNames.length)}:{' '}
            <Kb.Text type="BodySemibold">{props.subteamNames.join(', ')}</Kb.Text>.
          </Kb.Text>
        }
        header={<Header {...props} />}
        prompt={
          <Kb.Text type="Header" center={true} style={Styles.padding(0, Styles.globalMargins.small)}>
            You can't delete {props.teamname} because it has subteams.
          </Kb.Text>
        }
        onCancel={props.onBack}
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
      header={<Header {...props} />}
      onCancel={props.onBack}
      onConfirm={disabled ? undefined : props.onDelete}
      prompt={`Delete ${props.teamname}?`}
      waitingKey={Constants.deleteTeamWaitingKey(props.teamID)}
    />
  )
}

export default ReallyDeleteTeam
