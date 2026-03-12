import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Git from '@/stores/git'

type OwnProps = {id: string}

const emptyGit = Git.makeGitInfo()
const Container = (ownProps: OwnProps) => {
  const {id} = ownProps
  const git = Git.useGitState(s => s.idToInfo.get(id) || emptyGit)
  const error = Git.useGitState(s => s.error)
  const _name = git.name || ''
  const teamname = git.teamname || ''
  const waitingKey = C.waitingKeyGitLoading

  const deletePersonalRepo = Git.useGitState(s => s.dispatch.deletePersonalRepo)
  const deleteTeamRepo = Git.useGitState(s => s.dispatch.deleteTeamRepo)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)

  const _onDelete = (teamname: string | undefined, name: string, notifyTeam: boolean) => {
    if (teamname) {
      deleteTeamRepo(name, teamname, notifyTeam)
    } else {
      deletePersonalRepo(name)
    }
    navigateUp()
  }
  const onClose = () => {
    navigateUp()
  }
  const onDelete = (notifyTeam: boolean) => _onDelete(teamname, name, notifyTeam)

  const [name, setName] = React.useState('')
  const [notifyTeam, setNotifyTeam] = React.useState(true)

  if (!_name) return null

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
      onDelete(notifyTeam)
    }
  }
  return (
    <>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
          {!!error && (
            <Kb.Box2 direction="vertical" style={styles.error}>
              <Kb.Text type="Body" negative={true}>
                {error.message}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Text center={true} type="Header" style={{marginBottom: 27}}>
            Are you sure you want to delete this {teamname ? 'team ' : ''}
            repository?
          </Kb.Text>
          <Kb.ImageIcon type={teamname ? 'icon-repo-team-delete-48' : 'icon-repo-personal-delete-48'} />
          <Kb.Box2 direction="horizontal" alignItems="center" style={styles.avatarBox}>
            {!!teamname && (
              <Kb.Avatar
                isTeam={true}
                teamname={teamname}
                size={16}
                style={{marginRight: Kb.Styles.globalMargins.xtiny}}
              />
            )}
            <Kb.Text
              type="BodySemibold"
              style={{color: Kb.Styles.globalColors.redDark, textDecorationLine: 'line-through'}}
            >
              {teamname ? `${teamname}/${_name}` : _name}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text center={true} type="Body" style={{marginBottom: Kb.Styles.globalMargins.medium}}>
            {teamname
              ? 'This will permanently delete your remote files and history, and all members of the team will be notified.  This action cannot be undone.'
              : 'This will permanently delete your remote files and history. This action cannot be undone.'}
          </Kb.Text>
          <Kb.Text style={styles.confirm} type="BodySemibold">
            Enter the name of the repository to&nbsp;confirm:
          </Kb.Text>
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
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              type="Dim"
              onClick={onClose}
              label="Cancel"
              style={{marginRight: Kb.Styles.globalMargins.tiny}}
              waitingKey={waitingKey}
              onlyDisable={true}
            />
            <Kb.WaitingButton
              type="Danger"
              onClick={onSubmit}
              label={Kb.Styles.isMobile ? 'Delete' : 'Delete this repository'}
              disabled={!matchesName()}
              waitingKey={waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.ScrollView>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatarBox: {
    marginBottom: Kb.Styles.globalMargins.medium,
  },
  buttonBar: {alignItems: 'center'},
  checkbox: {
    alignSelf: 'flex-start',
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  confirm: {
    alignSelf: 'flex-start',
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
  container: Kb.Styles.platformStyles({
    common: {
      flex: 1,
      height: '100%',
    },
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
  error: {
    alignSelf: 'stretch',
    backgroundColor: Kb.Styles.globalColors.red,
    marginBottom: Kb.Styles.globalMargins.small,
    padding: Kb.Styles.globalMargins.tiny,
  },
}))

export default Container
