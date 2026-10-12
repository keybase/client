import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'

type OwnProps = {
  name: string
  teamname?: string
}

const DeleteRepo = (ownProps: OwnProps) => {
  const styles = useStyles()
  const _name = ownProps.name
  const teamname = ownProps.teamname ?? ''
  const [error, setError] = React.useState('')
  const waitingKey = C.waitingKeyGitLoading

  const deletePersonalRepo = C.useRPC(T.RPCGen.gitDeletePersonalRepoRpcPromise)
  const deleteTeamRepo = C.useRPC(T.RPCGen.gitDeleteTeamRepoRpcPromise)
  const navigateUp = C.Router2.navigateUp

  const onDelete = (notifyTeam: boolean) => {
    if (teamname) {
      deleteTeamRepo(
        [{notifyTeam, repoName: _name, teamName: {parts: teamname.split('.')}}, waitingKey],
        navigateUp,
        err => setError(err.message)
      )
    } else {
      deletePersonalRepo(
        [{repoName: _name}, waitingKey],
        navigateUp,
        err => setError(err.message)
      )
    }
  }

  const [name, setName] = React.useState('')
  const [notifyTeam, setNotifyTeam] = React.useState(true)

  const matchesName = () => {
    if (name === _name) {
      return true
    }

    if (teamname && name === `${teamname}/${_name}`) {
      return true
    }

    return false
  }

  const onSubmit = () => {
    if (matchesName()) {
      setError('')
      onDelete(notifyTeam)
    }
  }
  return (
    <Kb.ModalScreen
      banner={error ? <Kb.ErrorBanner error={error} /> : undefined}
      footer={
        <Kb.ConfirmButtons
          split={true}
          waitingKey={waitingKey}
          onCancel={navigateUp}
          onConfirm={onSubmit}
          confirmLabel={isMobile ? 'Delete' : 'Delete this repository'}
          confirmType="Danger"
          confirmDisabled={!matchesName()}
        />
      }
    >
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="medium">
        <Kb.ImageIcon type={teamname ? 'icon-repo-team-delete-48' : 'icon-repo-personal-delete-48'} />
        <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
          {!!teamname && <Kb.Avatar isTeam={true} teamname={teamname} size={16} />}
          <Kb.Text type="BodySemibold" style={styles.repoName}>
            {teamname ? `${teamname}/${_name}` : _name}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text center={true} type="Body">
          {teamname
            ? 'This will permanently delete your remote files and history, and all members of the team will be notified.  This action cannot be undone.'
            : 'This will permanently delete your remote files and history. This action cannot be undone.'}
        </Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySemibold">Enter the name of the repository to&nbsp;confirm:</Kb.Text>
          <Kb.Input3
            textType="BodySemibold"
            autoFocus={true}
            value={name}
            onChangeText={setName}
            onEnterKeyDown={onSubmit}
            placeholder="Name of the repository"
          />
          {!!teamname && (
            <Kb.Checkbox
              label="Notify the team"
              checked={notifyTeam}
              onCheck={setNotifyTeam}
              style={styles.checkbox}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  checkbox: {alignSelf: 'flex-start'},
  repoName: {color: theme.redDark, textDecorationLine: 'line-through'},
}))

export default DeleteRepo
