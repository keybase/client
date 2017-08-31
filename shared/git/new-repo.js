// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Input, Button, Dropdown} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

type Props = {
  isTeam: boolean,
  teams?: Array<string>,
  onCreate: (name: string) => void,
  onClose: () => void,
  onNewTeam: () => void,
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
        }}
      >
        <Avatar isTeam={true} teamname={item} size={16} style={{marginRight: globalMargins.tiny}} />
        <Text type="Header">{item}</Text>
      </Box>
    )
  }

  _dropdownChanged = (node: React.Node) => {
    if (node && node.key === NewTeamSentry) {
      this.props.onNewTeam()
    } else {
      this.setState({selectedTeam: (node && node.key) || null})
    }
  }

  render() {
    return (
      <Box style={_containerStyle}>
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
        {this.props.isTeam &&
          <Dropdown
            items={this._makeDropdownItems()}
            selected={this._makeDropdownItem(this.state.selectedTeam)}
            onChanged={this._dropdownChanged}
          />}
        <Input
          value={this.state.name}
          onChangeText={name => this.setState({name})}
          hintText="Name your respository"
        />
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
            onClick={() => this.props.onCreate(this.state.name)}
            label="Create"
            disabled={!this.state.name}
          />
        </Box>
      </Box>
    )
  }
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: '100%',
  padding: globalMargins.large,
}

const _addIconStyle = {
  marginBottom: 27,
}

export default NewRepo
