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

  _save = () => {
    this.setState({saving: true})
  }

  render() {
    return (
      <Box style={containerStyle}>
        <Button label="Save" onClick={this._save} style={{alignSelf: 'flex-start'}} type="Primary" />
        <SaveIndicator saving={this.state.saving} minSavingTimeMs={300} savedTimeoutMs={2500} />
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicatorContainer />)
}

export default load
