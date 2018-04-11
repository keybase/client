// @flow
import * as React from 'react'
import Box from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

type SaveState = 'same' | 'saving' | 'justSaved'

type Props = {
  saving: boolean,
  minSavingTimeMs: number,
  savedTimeoutMs: number,
}

type State = {
  saveState: SaveState,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: globalMargins.medium,
  justifyContent: 'center',
}

class SaveIndicator extends React.Component<Props, State> {
  saveStartTime: ?number

  constructor(props: Props) {
    super(props)
    this.state = {saveState: 'same'}
  }

  getDerivedStateFromProps = (nextProps: Props) => {
    if (nextProps.saving === this.props.saving) {
      return null
    }

    if (nextProps.saving) {
      this.saveStartTime = Date.now()
      return {saveState: 'saving'}
    }

    const dt = Date.now() - (this.saveStartTime || 0)
    if (dt < nextProps.minSavingTimeMs) {
      // Set state to 'justSaved' after minSavingTimeMs - dt.
      return null
    }

    // Set state to 'same' after savedTimeoutMs.
    return {saveState: 'justSaved'}
  }

  render = () => {
    switch (this.state.saveState) {
      case 'same':
        return null
      case 'saving':
        return <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.medium}} />
      case 'justSaved':
        return (
          <Box style={containerStyle}>
            <Icon type="iconfont-check" style={{color: globalColors.green}} />
            <Text type="BodySmall" style={{color: globalColors.green2}}>
              &nbsp; Saved
            </Text>
          </Box>
        )
    }
  }
}

export type {SaveState}
export default SaveIndicator
