// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Input, Checkbox, ScrollView, WaitingButton} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'

type Props = {
  error: ?Error,
  teamname?: string,
  name: string,
  onDelete: (notifyTeam: boolean) => void,
  onClose: () => void,
  waitingKey: string,
}

type State = {
  name: string,
  notifyTeam: boolean,
}

class DeleteRepo extends React.Component<Props, State> {
  state = {
    name: '',
    notifyTeam: true,
  }

  _matchesName = () => {
    if (this.state.name === this.props.name) {
      return true
    }

    if (this.props.teamname && this.state.name === `${this.props.teamname}/${this.props.name}`) {
      return true
    }

    return false
  }

  _onSubmit = () => {
    if (this._matchesName()) {
      this.props.onDelete(this.state.notifyTeam)
    }
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
            Are you sure you want to delete this {this.props.teamname ? 'team ' : ''}
            repository?
          </Text>
          <Icon type={this.props.teamname ? 'icon-repo-team-delete-48' : 'icon-repo-personal-delete-48'} />
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'center',
              marginBottom: globalMargins.medium,
            }}
          >
            {!!this.props.teamname && (
              <Avatar
                isTeam={true}
                teamname={this.props.teamname}
                size={16}
                style={{marginRight: globalMargins.xtiny}}
              />
            )}
            <Text type="BodySemibold" style={{color: globalColors.red, textDecorationLine: 'line-through'}}>
              {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
            </Text>
          </Box>
          <Text center={true} type="Body" style={{marginBottom: globalMargins.medium}}>
            {this.props.teamname
              ? 'This will permanently delete your remote files and history, and all members of the team will be notified.  This action cannot be undone.'
              : 'This will permanently delete your remote files and history. This action cannot be undone.'}
          </Text>
          <Text type="BodySemibold">Please type in the name of the repository to confirm:</Text>
          <Input
            autoFocus={true}
            value={this.state.name}
            onChangeText={name => this.setState({name})}
            onEnterKeyDown={this._onSubmit}
            hintText="Name of the repository"
          />
          {!!this.props.teamname && (
            <Checkbox
              label="Notify the team"
              checked={this.state.notifyTeam}
              onCheck={notifyTeam => this.setState({notifyTeam})}
              style={{marginBottom: globalMargins.small, marginTop: globalMargins.xlarge}}
            />
          )}
          <Box style={{flex: 1}} />
          <Box style={globalStyles.flexBoxRow}>
            <WaitingButton
              type="Secondary"
              onClick={this.props.onClose}
              label="Cancel"
              style={{marginRight: globalMargins.tiny}}
              waitingKey={this.props.waitingKey}
              onlyDisable={true}
            />
            <WaitingButton
              type="Danger"
              onClick={this._onSubmit}
              label={isMobile ? 'Delete' : 'Delete this repository'}
              disabled={!this._matchesName()}
              waitingKey={this.props.waitingKey}
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
  padding: isMobile ? globalMargins.large : globalMargins.xlarge,
}

export default DeleteRepo
