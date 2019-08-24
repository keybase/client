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
        <Kb.Box style={Styles.globalStyles.flexBoxCenter}>
          <Kb.Text type="BodyBig">Pick a team</Kb.Text>
        </Kb.Box>
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
      <Kb.Box
        key={item}
        style={{
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          width: '100%',
        }}
      >
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
      <Kb.ScrollView>
        <Kb.Box style={_containerStyle}>
          {!!this.props.error && (
            <Kb.Box
              style={{
                alignSelf: 'stretch',
                backgroundColor: Styles.globalColors.red,
                marginBottom: Styles.globalMargins.small,
                padding: Styles.globalMargins.tiny,
              }}
            >
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
            style={_addIconStyle}
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
              style={{marginBottom: Styles.globalMargins.small}}
            />
          )}
          <Kb.Input
            value={this.state.name}
            autoFocus={true}
            onChangeText={name => this.setState({name})}
            hintText="Name your repository"
            onEnterKeyDown={this._onSubmit}
          />
          {this.props.isTeam && (
            <Kb.Checkbox
              label="Notify the team"
              checked={this.state.notifyTeam}
              onCheck={notifyTeam => this.setState({notifyTeam})}
              style={{marginBottom: Styles.globalMargins.small, marginTop: Styles.globalMargins.small}}
            />
          )}
          <Kb.Box style={{flex: 1}} />
          <Kb.Box style={Styles.globalStyles.flexBoxRow}>
            <Kb.WaitingButton
              type="Dim"
              onClick={this.props.onClose}
              label="Cancel"
              style={{marginRight: Styles.globalMargins.tiny}}
              waitingKey={this.props.waitingKey}
              onlyDisable={true}
            />
            <Kb.WaitingButton
              onClick={this._onSubmit}
              label="Create"
              disabled={!this._canSubmit()}
              waitingKey={this.props.waitingKey}
            />
          </Kb.Box>
        </Kb.Box>
      </Kb.ScrollView>
    )
  }
}

const _containerStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: '100%',
  padding: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.large,
}

const _addIconStyle = {
  marginBottom: 27,
}

export default Kb.HeaderOrPopup(NewRepo)
