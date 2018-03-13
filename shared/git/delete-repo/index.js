// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Input, Button, Checkbox, ScrollView} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'

type Props = {
  loading: boolean,
  error: ?Error,
  teamname?: string,
  name: string,
  onDelete: (notifyTeam: boolean) => void,
  onClose: () => void,
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
            Are you sure you want to delete this {this.props.teamname ? 'team ' : ''}repository?
          </Text>
          <Icon type={this.props.teamname ? 'icon-repo-team-delete-48' : 'icon-repo-personal-delete-48'} />
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: 27}}>
            {!!this.props.teamname && (
              <Avatar
                isTeam={true}
                teamname={this.props.teamname}
                size={12}
                style={{marginRight: globalMargins.xtiny}}
              />
            )}
            <Text type="BodyError" style={{textDecorationLine: 'line-through'}}>
              {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
            </Text>
          </Box>
          <Text type="Body" style={{marginBottom: 27}}>
            {this.props.teamname
              ? 'This will permanently delete your remote files and history, and all members of the team will be notified. This action cannot be undone.'
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
              type="Danger"
              onClick={this._onSubmit}
              label={isMobile ? 'Delete' : 'Delete this repository'}
              disabled={!this._matchesName()}
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
  padding: globalMargins.large,
}

export default DeleteRepo
