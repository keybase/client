import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  error?: Error
  isTeam: boolean
  onClose: () => void
  onCreate: (name: string, teamname: string | null, notifyTeam: boolean) => void
  onNewTeam: () => void
  teams?: Array<string>
  waitingKey: string
  loadTeams: () => void
}

type State = {
  name: string
  notifyTeam: boolean
  selectedTeam: string | null
}

const NewTeamSentry = '---NewTeam---'

class NewRepo extends React.Component<Props, State> {
  state = {
    name: '',
    notifyTeam: true,
    selectedTeam: null,
  }

  _makeDropdownItems = () => {
    return (this.props.teams || []).concat(NewTeamSentry).map(this._makeDropdownItem)
  }

  _makeDropdownItem = (item: string | null) => {
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
            ...Styles.globalStyles.flexBoxRow,
            alignItems: 'center',
            paddingLeft: Styles.globalMargins.small,
          }}
        >
          <Kb.Text type="Header">New team...</Kb.Text>
        </Kb.Box>
      )
    }

    return (
      <Kb.Box key={item} style={styles.avatarBox}>
        <Kb.Avatar isTeam={true} teamname={item} size={16} style={{marginRight: Styles.globalMargins.tiny}} />
        <Kb.Text
          type="Header"
          style={Styles.platformStyles({
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
      </Kb.Box>
    )
  }

  _dropdownChanged = (node: React.ReactElement) => {
    if (node && node.key === NewTeamSentry) {
      this.props.onNewTeam()
    } else {
      // @ts-ignore doesn't understand key will be string
      const selectedTeam: string = node.key
      this.setState({selectedTeam})
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
                onChanged={this._dropdownChanged}
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

const styles = Styles.styleSheetCreate(() => ({
  addIcon: {marginBottom: 27},
  avatarBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.small,
    width: '100%',
  },
  buttonBar: {alignItems: 'center'},
  checkbox: {
    alignSelf: 'flex-start',
    marginTop: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      height: '100%',
      padding: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.large,
    },
    isElectron: {maxWidth: 400},
    isTablet: {
      alignSelf: 'center',
      marginTop: Styles.globalMargins.xsmall,
      width: 500,
    },
  }),
  dropdown: {
    marginBottom: Styles.globalMargins.small,
    width: '100%',
  },
  dropdownItem: {
    justifyContent: 'flex-start',
    paddingLeft: Styles.globalMargins.xsmall,
  },
  error: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.red,
    marginBottom: Styles.globalMargins.small,
    padding: Styles.globalMargins.tiny,
  },
}))

export default NewRepo
