// @flow
import React, {Component} from 'react'
import {Box, Button, Header, Input, PopupDialog, Text} from '../../../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

class Contents extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      name: '',
    }
  }

  _updateName = name => {
    this.setState({name})
  }

  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Header windowDragging={false} style={{backgroundColor: globalColors.blue}}>
          <Text style={{margin: globalMargins.tiny}} type="BodySemibold" backgroundMode="Announcements">
            Team names are unique for security reasons.
          </Text>
        </Header>

        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            marginBottom: 80,
            marginLeft: 80,
            marginRight: 80,
            marginTop: 90,
          }}
        >
          <Input
            autoFocus={true}
            hintText="Name your team"
            value={this.state.name}
            onChangeText={this._updateName}
          />
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
            <Button
              type="Primary"
              style={{marginLeft: globalMargins.tiny}}
              onClick={this.props.onCreateNewTeam}
              label="Create team"
            />
          </Box>
        </Box>
      </Box>
    )
  }
}
const NewTeamDialog = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

export default NewTeamDialog
