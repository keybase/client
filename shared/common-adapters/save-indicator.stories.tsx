import * as React from 'react'
import * as Styles from '../styles'
import SaveIndicator from './save-indicator'
import {storiesOf, action} from '../stories/storybook'
import Box from './box'
import Button from './button'

const Kb = {
  Box,
  Button,
}

type State = {
  saving: boolean
}

const containerStyle = {
  ...Styles.globalStyles.flexBoxColumn,
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
      <Kb.Box style={containerStyle}>
        <Kb.Button
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
      </Kb.Box>
    )
  }
}

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicatorContainer />)
}

export default load
