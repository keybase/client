import * as C from '@/constants'
import * as Git from '@/stores/git'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'

type OwnProps = {isTeam: boolean}
const NewTeamSentry = '---NewTeam---'

const Container = (ownProps: OwnProps) => {
  const {isTeam} = ownProps
  const error = Git.useGitState(s => s.error)
  const teamnames = Teams.useTeamsState(s => s.teamnames)
  const teams = [...teamnames].sort(Teams.sortTeamnames)
  const waitingKey = C.waitingKeyGitLoading
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const getTeams = Teams.useTeamsState(s => s.dispatch.getTeams)
  const loadTeams = getTeams
  const onClose = navigateUp
  const createPersonalRepo = Git.useGitState(s => s.dispatch.createPersonalRepo)
  const createTeamRepo = Git.useGitState(s => s.dispatch.createTeamRepo)
  const onCreate = (name: string, teamname: string, notifyTeam: boolean) => {
    if (isTeam && teamname) {
      createTeamRepo(name, teamname, notifyTeam)
    } else {
      createPersonalRepo(name)
    }
    navigateUp()
  }
  const launchNewTeamWizardOrModal = Teams.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onNewTeam = () => {
    switchTab(C.Tabs.teamsTab)
    launchNewTeamWizardOrModal()
  }

  const [name, setName] = React.useState('')
  const [notifyTeam, setNotifyTeam] = React.useState(true)
  const [selectedTeam, setSelectedTeam] = React.useState('')

  React.useEffect(() => {
    loadTeams()
  }, [loadTeams])

  const makeDropdownItems = () => {
    return teams.concat(NewTeamSentry).map(makeDropdownItem)
  }

  const makeDropdownItem = (item?: string) => {
    if (!item) {
      return (
        <Kb.Box2 alignItems="center" direction="horizontal" fullWidth={true} style={styles.dropdownItem}>
          <Kb.Text type="BodyBig">Pick a team</Kb.Text>
        </Kb.Box2>
      )
    }

    if (item === NewTeamSentry) {
      return (
        <Kb.Box
          key={NewTeamSentry}
          style={{
            ...Kb.Styles.globalStyles.flexBoxRow,
            alignItems: 'center',
            paddingLeft: Kb.Styles.globalMargins.small,
          }}
        >
          <Kb.Text type="Header">New team...</Kb.Text>
        </Kb.Box>
      )
    }

    return (
      <Kb.Box2 direction="vertical" key={item} style={styles.avatarBox}>
        <Kb.Avatar
          isTeam={true}
          teamname={item}
          size={16}
          style={{marginRight: Kb.Styles.globalMargins.tiny}}
        />
        <Kb.Text
          type="Header"
          style={Kb.Styles.platformStyles({
            common: {
              overflow: 'hidden',
              width: '100%',
            },
            isElectron: {
              display: 'block',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          })}
        >
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
    onCreate(name, selectedTeam, isTeam && notifyTeam)
  }

  const canSubmit = () => {
    return name && !(isTeam && !selectedTeam)
  }
  return (
    <Kb.PopupWrapper onCancel={onClose}>
      <Kb.ScrollView>
        <Kb.Box style={styles.container}>
          {!!error && (
            <Kb.Box style={styles.error}>
              <Kb.Text type="Body" negative={true}>
                {error.message}
              </Kb.Text>
            </Kb.Box>
          )}
          <Kb.Text type="Header" style={{marginBottom: 27}}>
            New {isTeam ? 'team' : 'personal'} git repository
          </Kb.Text>
          <Kb.Icon
            type={isTeam ? 'icon-repo-team-add-48' : 'icon-repo-personal-add-48'}
            style={styles.addIcon}
          />
          <Kb.Text type="Body" style={{marginBottom: 27}}>
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
          <Kb.LabeledInput
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
              onClick={onClose}
              label="Cancel"
              waitingKey={waitingKey}
              onlyDisable={true}
            />
            <Kb.WaitingButton
              onClick={onSubmit}
              label="Create"
              disabled={!canSubmit()}
              waitingKey={waitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.ScrollView>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addIcon: {marginBottom: 27},
      avatarBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
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
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          height: '100%',
          padding: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.large,
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
      dropdownItem: {
        justifyContent: 'flex-start',
        paddingLeft: Kb.Styles.globalMargins.xsmall,
      },
      error: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.red,
        marginBottom: Kb.Styles.globalMargins.small,
        padding: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default Container
