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
  lastStateChangeTime: number,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: globalMargins.medium,
  justifyContent: 'center',
}

class SaveIndicator extends React.Component<Props, State> {
  _timeoutID: ?TimeoutID

  constructor(props: Props) {
    super(props)
    this.state = {saveState: 'same', lastStateChangeTime: Date.now()}
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    if (nextProps.saving) {
      if (prevState.saveState !== 'same') {
        // Already saving.
        return null
      }

      return {saveState: 'saving', lastStateChangeTime: Date.now()}
    }

    if (prevState.saveState === 'same') {
      // Already not saving.
      return null
    }

    const dt = Date.now() - prevState.lastStateChangeTime
    if (dt < nextProps.minSavingTimeMs) {
      // Set state to 'justSaved' after minSavingTimeMs - dt.
      return null
    }

    // Set state to 'same' after savedTimeoutMs.
    return {saveState: 'justSaved', lastStateChangeTime: Date.now()}
  }

  resetTimeout = (fn: () => void, delay: number) => {
    if (this._timeoutID) {
      clearTimeout(this._timeoutID)
    }
    this._timeoutID = setTimeout(fn, delay)
  }

  componentDidUpdate = (prevProps: Props) => {
    if (prevProps.saving === this.props.saving) {
      return
    }

    if (this.props.saving) {
      return
    }

    if (this.state.saveState === 'saving') {
      const dt = Date.now() - this.state.lastStateChangeTime
      if (dt < this.props.minSavingTimeMs) {
        this.resetTimeout(() => {
          this.setState({saveState: 'justSaved', lastStateChangeTime: Date.now()})
        }, this.props.minSavingTimeMs - dt)
      }
      return
    }

    if (this.state.saveState === 'justSaved') {
      this.resetTimeout(() => {
        this.setState({saveState: 'same', lastStateChangeTime: Date.now()})
      }, this.props.savedTimeoutMs)
    }
  }

  render = () => {
    switch (this.state.saveState) {
      case 'same':
        return null
      case 'saving':
        return (
          <Box style={containerStyle}>
            <ProgressIndicator style={{width: globalMargins.medium}} />
          </Box>
        )
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
