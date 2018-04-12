// @flow
import * as React from 'react'
import {default as SaveIndicator} from './save-indicator'
import {storiesOf} from '../stories/storybook'
import {globalStyles} from '../styles'
import Box from './box'
import Button from './button'

type State = {
  saving: boolean,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
}

class SaveIndicatorContainer extends React.Component<{}, State> {
  constructor() {
    super({})
    this.state = {saving: false}
  }

  _toggleSave = () => {
    this.setState(state => ({
      saving: !state.saving,
    }))
  }

  render() {
    return (
      <Box style={containerStyle}>
        <Button
          label={this.state.saving ? 'Stop save' : 'Start save'}
          onClick={this._toggleSave}
          style={{alignSelf: 'flex-start'}}
          type="Primary"
        />
        <SaveIndicator saving={this.state.saving} minSavingTimeMs={2000} savedTimeoutMs={3000} />
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicatorContainer />)
}

export default load
