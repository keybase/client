import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'

type OwnProps = {
  name: string
  teamname?: string
}

const DeleteRepo = (ownProps: OwnProps) => {
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
    <Kb.ScrollView>
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} fullHeight={true} flex={1} gap="medium" style={styles.container}>
        <Kb.ErrorBanner error={error} />
        <Kb.Text center={true} type="Header">
          Are you sure you want to delete this {teamname ? 'team ' : ''}
          repository?
        </Kb.Text>
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
        <Kb.ConfirmButtons
          waitingKey={waitingKey}
          onCancel={navigateUp}
          onConfirm={onSubmit}
          confirmLabel={isMobile ? 'Delete' : 'Delete this repository'}
          confirmType="Danger"
          confirmDisabled={!matchesName()}
        />
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: {alignSelf: 'flex-start'},
  container: Kb.Styles.platformStyles({
    isElectron: {
      maxHeight: 560,
      padding: Kb.Styles.globalMargins.large,
      paddingBottom: Kb.Styles.globalMargins.small,
      width: 400,
    },
    isMobile: {
      padding: Kb.Styles.globalMargins.small,
    },
  }),
  repoName: {color: Kb.Styles.globalColors.redDark, textDecorationLine: 'line-through'},
}))

export default DeleteRepo
