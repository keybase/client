// @flow
import * as React from 'react'
import {type SaveStateType, SaveStateComponent} from '../notifications'
import RetentionPicker, {type OwnProps} from '../../../../teams/team/settings/retention/container'
import {Box, HOCTimers} from '../../../../common-adapters'
import {globalStyles, globalMargins} from '../../../../styles/'

export type Props = OwnProps & {
  saving: boolean,
  showSaveState: boolean,
  setTimeout: typeof setTimeout,
  clearTimeout: typeof clearTimeout,
}

export type State = {
  saveState: SaveStateType,
}

class RetentionWithSaveState extends React.Component<Props, State> {
  state = {
    saveState: 'same',
  }

  render() {
    return (
      <React.Fragment>
        <RetentionPicker
          conversationIDKey={this.props.conversationIDKey}
          containerStyle={this.props.containerStyle}
          dropdownStyle={this.props.dropdownStyle}
          entityType={this.props.entityType}
          teamname={this.props.teamname}
          type={this.props.type}
          onSelect={this.props.onSelect}
        />
        {this.props.showSaveState && (
          <Box style={styleSaveState}>
            <SaveStateComponent saveState={this.state.saveState} />
          </Box>
        )}
      </React.Fragment>
    )
  }
}

const styleSaveState = {
  ...globalStyles.flexBoxRow,
  height: globalMargins.large,
  justifyContent: 'center',
  paddingTop: globalMargins.small,
}

export default HOCTimers(RetentionWithSaveState)
