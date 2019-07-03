import * as React from 'react'
import SaveIndicator from './save-indicator'
import {storiesOf, action} from '../stories/storybook'
import {globalStyles} from '../styles'
import Box from './box'
import Button from './button'

type State = {
  saving: boolean
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
}

class SaveIndicatorContainer extends React.Component<{}, State> {
  constructor(props) {
    super(props)
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
        />
        <SaveIndicator
          saving={this.state.saving}
          minSavingTimeMs={2000}
          savedTimeoutMs={3000}
          debugLog={action('debugLog')}
        />
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicatorContainer />)
}

export default load
