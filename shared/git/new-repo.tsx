import * as C from '@/constants'
import * as Teams from '@/constants/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {makeNewTeamWizard} from '@/teams/new-team/wizard/state'
import {useTeamsList} from '@/teams/use-teams-list'

type OwnProps = {isTeam: boolean}
const NewTeamSentry = '---NewTeam---'

const NewRepo = (ownProps: OwnProps) => {
  const {isTeam} = ownProps
  const [error, setError] = React.useState('')
  const {teams: loadedTeams} = useTeamsList()
  const teams = React.useMemo(
    () => loadedTeams.map(team => team.teamname).sort(Teams.sortTeamnames),
    [loadedTeams]
  )
  const navigateUp = C.Router2.navigateUp
  const createPersonalRepo = C.useRPC(T.RPCGen.gitCreatePersonalRepoRpcPromise)
  const createTeamRepo = C.useRPC(T.RPCGen.gitCreateTeamRepoRpcPromise)
  const onCreate = (name: string, teamname: string, notifyTeam: boolean) => {
    if (isTeam && teamname) {
      createTeamRepo(
        [{notifyTeam, repoName: name, teamName: {parts: teamname.split('.')}}, C.waitingKeyGitLoading],
        navigateUp,
        err => setError(err.message)
      )
    } else {
      createPersonalRepo(
        [{repoName: name}, C.waitingKeyGitLoading],
        navigateUp,
        err => setError(err.message)
      )
    }
  }
  const switchTab = C.Router2.switchTab
  const navigateAppend = C.Router2.navigateAppend
  const onNewTeam = () => {
    switchTab(C.Tabs.teamsTab)
    navigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}})
  }

  const [name, setName] = React.useState('')
  const [notifyTeam, setNotifyTeam] = React.useState(true)
  const [selectedTeam, setSelectedTeam] = React.useState('')

  const makeDropdownItems = () => teams.concat(NewTeamSentry).map(makeDropdownItem)

  const makeDropdownItem = (item?: string) => {
    if (!item) {
      return (
        <Kb.Box2 alignItems="center" direction="horizontal" fullWidth={true} style={styles.avatarBox} justifyContent="flex-start">
          <Kb.Text type="BodyBig">Pick a team</Kb.Text>
        </Kb.Box2>
      )
    }

    if (item === NewTeamSentry) {
      return (
        <Kb.Text key={NewTeamSentry} type="Header" style={styles.newTeamItem}>
          New team...
        </Kb.Text>
      )
    }

    return (
      <Kb.Box2 direction="horizontal" key={item} alignItems="center" style={styles.avatarBox}>
        <Kb.Avatar
          isTeam={true}
          teamname={item}
          size={16}
          style={styles.teamAvatar}
        />
        <Kb.Text type="Header" style={styles.teamName}>
          {item}
        </Kb.Text>
      </Kb.Box2>
    )
  }

  const dropdownChanged = (idx: number) => {
    const t = teams.at(idx)
    if (!t) {
      onNewTeam()
    } else {
      setSelectedTeam(t)
    }
  }

  const onSubmit = () => {
    setError('')
    onCreate(name, selectedTeam, isTeam && notifyTeam)
  }

  const canSubmit = () => {
    return name && !(isTeam && !selectedTeam)
  }
  return (
    <Kb.ScrollView>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1} alignItems="center" style={styles.container}>
        {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
        <Kb.Text type="Header" style={styles.marginBottom27}>
          New {isTeam ? 'team' : 'personal'} git repository
        </Kb.Text>
        <Kb.IconAuto
          type={isTeam ? 'icon-repo-team-add-48' : 'icon-repo-personal-add-48'}
          style={styles.marginBottom27}
        />
        <Kb.Text type="Body" style={styles.marginBottom27}>
          {isTeam
            ? 'Your repository will be end-to-end encrypted and accessible by all members in the team.'
            : 'Your repository will be encrypted and only accessible by you.'}
        </Kb.Text>
        {isTeam && (
          <Kb.Dropdown
            items={makeDropdownItems()}
            selected={makeDropdownItem(selectedTeam)}
            onChangedIdx={dropdownChanged}
            style={styles.dropdown}
          />
        )}
        <Kb.Input3
          value={name}
          autoFocus={true}
          onChangeText={setName}
          placeholder="Name your repository"
          onEnterKeyDown={onSubmit}
        />
        {isTeam && (
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
            onClick={navigateUp}
            label="Cancel"
            waitingKey={C.waitingKeyGitLoading}
            onlyDisable={true}
          />
          <Kb.WaitingButton
            onClick={onSubmit}
            label="Create"
            disabled={!canSubmit()}
            waitingKey={C.waitingKeyGitLoading}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarBox: {
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      buttonBar: {alignItems: 'center'},
      checkbox: {
        alignSelf: 'flex-start',
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      container: Kb.Styles.platformStyles({
        common: {
          padding: isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.large,
        },
        isElectron: {maxWidth: 400},
        isTablet: {
          alignSelf: 'center',
          marginTop: Kb.Styles.globalMargins.xsmall,
          width: 500,
        },
      }),
      dropdown: {
        marginBottom: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      marginBottom27: {marginBottom: 27},
      newTeamItem: {paddingLeft: Kb.Styles.globalMargins.small},
      teamAvatar: {marginRight: Kb.Styles.globalMargins.tiny},
      teamName: Kb.Styles.platformStyles({
        common: {
          overflow: 'hidden',
          width: '100%',
        },
        isElectron: {
          display: 'block',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
    }) as const
)

export default NewRepo
