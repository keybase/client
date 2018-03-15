// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Input, Button, Dropdown, Checkbox, ScrollView} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile, platformStyles} from '../../styles'

type Props = {
  error: ?Error,
  isTeam: boolean,
  loading: boolean,
  onClose: () => void,
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => void,
  onNewTeam: () => void,
  teams?: Array<string>,
}

type State = {
  name: string,
  notifyTeam: boolean,
  selectedTeam: ?string,
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

  _makeDropdownItem = (item: ?string) => {
    if (!item) {
      return (
        <Box style={globalStyles.flexBoxCenter}>
          <Text type="Header">Pick a team</Text>
        </Box>
      )
    }

    if (item === NewTeamSentry) {
      return (
        <Box
          key={NewTeamSentry}
          style={{...globalStyles.flexBoxRow, alignItems: 'center', paddingLeft: globalMargins.small}}
        >
          <Text type="Header">New team...</Text>
        </Box>
      )
    }

    return (
      <Box
        key={item}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          paddingLeft: globalMargins.small,
          paddingRight: globalMargins.small,
          width: '100%',
        }}
      >
        <Avatar isTeam={true} teamname={item} size={16} style={{marginRight: globalMargins.tiny}} />
        <Text
          type="Header"
          style={platformStyles({
            common: {
              width: '100%',
              overflow: 'hidden',
            },
            isElectron: {
              display: 'block',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          })}
        >
          {item}
        </Text>
      </Box>
    )
  }

  _dropdownChanged = (node: React.Node) => {
    // $FlowIssue doesn't understand key will be string
    if (node && node.key === NewTeamSentry) {
      this.props.onNewTeam()
    } else {
      // $FlowIssue doesn't understand key will be string
      const selectedTeam: string = (node && node.key) || null
      this.setState({selectedTeam})
    }
  }

  _onSubmit = () => {
    this.props.onCreate(this.state.name, this.state.selectedTeam, this.props.isTeam && this.state.notifyTeam)
  }

  _canSubmit = () => {
    return this.state.name && !(this.props.isTeam && !this.state.selectedTeam)
  }

  render() {
    return (
      <ScrollView>
        <Box style={_containerStyle}>
          {!!this.props.error && (
            <Box
              style={{
                alignSelf: 'stretch',
                backgroundColor: globalColors.red,
                marginBottom: globalMargins.small,
                padding: globalMargins.tiny,
              }}
            >
              <Text type="Body" backgroundMode="Terminal">
                {this.props.error.message}
              </Text>
            </Box>
          )}
          <Text type="Header" style={{marginBottom: 27}}>
            New {this.props.isTeam ? 'team' : 'personal'} git repository
          </Text>
          <Icon
            type={this.props.isTeam ? 'icon-repo-team-add-48' : 'icon-repo-personal-add-48'}
            style={_addIconStyle}
          />
          <Text type="Body" style={{marginBottom: 27}}>
            {this.props.isTeam
              ? 'Your repository will be end-to-end encrypted and accessible by all members in the team.'
              : 'Your repository will be encrypted and only accessible by you.'}
          </Text>
          {this.props.isTeam && (
            <Dropdown
              items={this._makeDropdownItems()}
              selected={this._makeDropdownItem(this.state.selectedTeam)}
              onChanged={this._dropdownChanged}
              style={{marginBottom: globalMargins.small}}
            />
          )}
          <Input
            value={this.state.name}
            autoFocus={true}
            onChangeText={name => this.setState({name})}
            hintText="Name your repository"
            onEnterKeyDown={this._onSubmit}
          />
          {this.props.isTeam && (
            <Checkbox
              label="Notify the team"
              checked={this.state.notifyTeam}
              onCheck={notifyTeam => this.setState({notifyTeam})}
              style={{marginBottom: globalMargins.small, marginTop: globalMargins.small}}
            />
          )}
          <Box style={{flex: 1}} />
          <Box style={globalStyles.flexBoxRow}>
            <Button
              type="Secondary"
              onClick={this.props.onClose}
              label="Cancel"
              style={{marginRight: globalMargins.tiny}}
            />
            <Button
              type="Primary"
              onClick={this._onSubmit}
              label="Create"
              disabled={!this._canSubmit()}
              waiting={this.props.loading}
            />
          </Box>
        </Box>
      </ScrollView>
    )
  }
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: '100%',
  padding: isMobile ? globalMargins.tiny : globalMargins.large,
}

const _addIconStyle = {
  marginBottom: 27,
}

export default NewRepo
