// @flow
import * as React from 'react'
import {type SaveState, default as SaveIndicator} from './save-indicator'
import {storiesOf} from '../stories/storybook'
import {globalStyles} from '../styles'
import Box from './box'
import Button from './button'

type State = {
  saveState: SaveState,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
}

class SaveIndicatorContainer extends React.Component<{}, State> {
  constructor() {
    super({})
    this.state = {saveState: 'same'}
  }

  _save = () => {
    this.setState({saveState: 'justSaved'})
  }

  render() {
    return (
      <Box style={containerStyle}>
        <Button label="Save" onClick={this._save} type="Primary" />
        <SaveIndicator saveState={this.state.saveState} />
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicatorContainer />)
}

export default load
