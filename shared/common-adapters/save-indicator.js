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
  onStateChange?: string => void,
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
      if (prevState.saveState === 'saving') {
        // Already saving, so nothing to do.
        return null
      }

      return {saveState: 'saving', lastStateChangeTime: Date.now()}
    }

    if (prevState.saveState === 'same' || prevState.saveState === 'justSaved') {
      // Already done saving, so nothing to do.
      return null
    }

    const dt = Date.now() - prevState.lastStateChangeTime
    if (dt < nextProps.minSavingTimeMs) {
      // (1) Save took less than minSavingTimeMs, so stay in the
      // saving state, set a timer in componentDidUpdate to transition
      // to 'justSaved'. (See (1) below.)
      return null
    }

    // (2) Save took at least minSavingTimeMs, so transition to
    // justSaved, and set a timer in componentDidUpdate to transition
    // to 'same'. (See (2) below.)
    return {saveState: 'justSaved', lastStateChangeTime: Date.now()}
  }

  _resetTimeout = (fn: () => void, delay: number) => {
    if (this._timeoutID) {
      clearTimeout(this._timeoutID)
    }
    this._timeoutID = setTimeout(fn, delay)
  }

  componentDidUpdate = (prevProps: Props, prevState: State) => {
    const onStateChange = this.props.onStateChange
    if (onStateChange && prevState.saveState !== this.state.saveState) {
      const dtS = (Date.now() - prevState.lastStateChangeTime) / 1000
      onStateChange(`was in '${prevState.saveState}' for ${dtS}s, now in '${this.state.saveState}'`)
    }

    if (this.props.saving) {
      // Already handled in getDerivedStateFromProps.
      return
    }

    switch (this.state.saveState) {
      case 'same':
        // Nothing to do.
        return

      case 'saving': {
        // (1) Transition to 'justSaved', either now or later.
        const dt = Date.now() - this.state.lastStateChangeTime
        if (dt < this.props.minSavingTimeMs) {
          this._resetTimeout(() => {
            this.setState({saveState: 'justSaved', lastStateChangeTime: Date.now()})
          }, this.props.minSavingTimeMs - dt)
        }
        return
      }

      case 'justSaved': {
        // (2) Transition to 'same', either now or later.
        const dt = Date.now() - this.state.lastStateChangeTime
        if (dt < this.props.savedTimeoutMs) {
          this._resetTimeout(() => {
            this.setState({saveState: 'same', lastStateChangeTime: Date.now()})
          }, this.props.savedTimeoutMs - dt)
        }
      }
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
