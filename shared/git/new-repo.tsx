import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'

type OwnProps = {isTeam: boolean}

const Container = (ownProps: OwnProps) => {
  const {isTeam} = ownProps
  const error = C.useGitState(s => s.error)
  const teamnames = C.useTeamsState(s => s.teamnames)
  const teams = [...teamnames].sort(C.Teams.sortTeamnames)

  const waitingKey = C.Git.loadingWaitingKey

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const getTeams = C.useTeamsState(s => s.dispatch.getTeams)
  const loadTeams = getTeams
  const onClose = () => {
    navigateUp()
  }

  const createPersonalRepo = C.useGitState(s => s.dispatch.createPersonalRepo)
  const createTeamRepo = C.useGitState(s => s.dispatch.createTeamRepo)
  const onCreate = (name: string, teamname: string, notifyTeam: boolean) => {
    if (isTeam && teamname) {
      createTeamRepo(name, teamname, notifyTeam)
    } else {
      createPersonalRepo(name)
    }
    navigateUp()
  }
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onNewTeam = () => {
    switchTab(C.Tabs.teamsTab)
    launchNewTeamWizardOrModal()
  }
  const props = {
    error,
    isTeam,
    loadTeams,
    onClose,
    onCreate,
    onNewTeam,
    teams,
    waitingKey,
  }
  return <NewRepo {...props} />
}

type Props = {
  error?: Error
  isTeam: boolean
  onClose: () => void
  onCreate: (name: string, teamname: string, notifyTeam: boolean) => void
  onNewTeam: () => void
  teams?: Array<string>
  waitingKey: string
  loadTeams: () => void
}

type State = {
  name: string
  notifyTeam: boolean
  selectedTeam: string
}

const NewTeamSentry = '---NewTeam---'

class NewRepo extends React.Component<Props, State> {
  state = {
    name: '',
    notifyTeam: true,
    selectedTeam: '',
  }

  _makeDropdownItems = () => {
    return (this.props.teams || []).concat(NewTeamSentry).map(this._makeDropdownItem)
  }

  _makeDropdownItem = (item?: string) => {
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

  _dropdownChanged = (idx: number) => {
    const t = this.props.teams?.at(idx)
    if (!t) {
      this.props.onNewTeam()
    } else {
      this.setState({selectedTeam: t})
    }
  }

  _onSubmit = () => {
    this.props.onCreate(this.state.name, this.state.selectedTeam, this.props.isTeam && this.state.notifyTeam)
  }

  _canSubmit = () => {
    return this.state.name && !(this.props.isTeam && !this.state.selectedTeam)
  }

  componentDidMount() {
    this.props.loadTeams()
  }

  render() {
    return (
      <Kb.PopupWrapper onCancel={this.props.onClose}>
        <Kb.ScrollView>
          <Kb.Box style={styles.container}>
            {!!this.props.error && (
              <Kb.Box style={styles.error}>
                <Kb.Text type="Body" negative={true}>
                  {this.props.error.message}
                </Kb.Text>
              </Kb.Box>
            )}
            <Kb.Text type="Header" style={{marginBottom: 27}}>
              New {this.props.isTeam ? 'team' : 'personal'} git repository
            </Kb.Text>
            <Kb.Icon
              type={this.props.isTeam ? 'icon-repo-team-add-48' : 'icon-repo-personal-add-48'}
              style={styles.addIcon}
            />
            <Kb.Text type="Body" style={{marginBottom: 27}}>
              {this.props.isTeam
                ? 'Your repository will be end-to-end encrypted and accessible by all members in the team.'
                : 'Your repository will be encrypted and only accessible by you.'}
            </Kb.Text>
            {this.props.isTeam && (
              <Kb.Dropdown
                items={this._makeDropdownItems()}
                selected={this._makeDropdownItem(this.state.selectedTeam)}
                onChangedIdx={this._dropdownChanged}
                style={styles.dropdown}
              />
            )}
            <Kb.LabeledInput
              value={this.state.name}
              autoFocus={true}
              onChangeText={name => this.setState({name})}
              placeholder="Name your repository"
              onEnterKeyDown={this._onSubmit}
            />
            {this.props.isTeam && (
              <Kb.Checkbox
                label="Notify the team"
                checked={this.state.notifyTeam}
                onCheck={notifyTeam => this.setState({notifyTeam})}
                style={styles.checkbox}
              />
            )}
            <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
              <Kb.WaitingButton
                type="Dim"
                onClick={this.props.onClose}
                label="Cancel"
                waitingKey={this.props.waitingKey}
                onlyDisable={true}
              />
              <Kb.WaitingButton
                onClick={this._onSubmit}
                label="Create"
                disabled={!this._canSubmit()}
                waitingKey={this.props.waitingKey}
              />
            </Kb.ButtonBar>
          </Kb.Box>
        </Kb.ScrollView>
      </Kb.PopupWrapper>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
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
}))

export default Container
