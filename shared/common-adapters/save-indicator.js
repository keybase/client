// @flow
import * as React from 'react'
import Box from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

type SaveState = 'same' | 'saving' | 'justSaved'

type SaveState2 = 'steady' | 'saving' | 'savingHysteresis' | 'justSaved'

type Props = {
  saving: boolean,
  minSavingTimeMs: number,
  savedTimeoutMs: number,
  onStateChange?: string => void,
}

type State = {
  saving: boolean,
  savingChanged: number,
  saveState: SaveState2,
  saveStateChanged: number,
}

const computeNextState = (props: Props, state: State, now: number): null | SaveState2 | number => {
  const timeSinceSavingChanged = now - state.savingChanged
  const timeSinceSaveStateChanged = now - state.saveStateChanged

  const {saveState} = state
  switch (saveState) {
    case 'steady':
      if (state.saving) {
        return 'saving'
      }

      if (timeSinceSaveStateChanged <= props.savedTimeoutMs) {
        return 'justSaved'
      }

      return null

    case 'saving':
      if (state.saving) {
        return null
      }

      if (timeSinceSavingChanged <= props.minSavingTimeMs) {
        return 'savingHysteresis'
      } else {
        return 'justSaved'
      }

    case 'savingHysteresis':
      if (state.saving) {
        return 'saving'
      }

      const timeToJustSaved = timeSinceSavingChanged - props.minSavingTimeMs
      if (timeToJustSaved <= 0) {
        return 'justSaved'
      }

      return timeToJustSaved

    case 'justSaved':
      if (state.saving) {
        return 'saving'
      }

      if (timeSinceSavingChanged <= props.minSavingTimeMs) {
        return 'savingHysteresis'
      }

      const timeToSteady = timeSinceSaveStateChanged - props.savedTimeoutMs
      if (timeToSteady <= 0) {
        return 'steady'
      }

      return timeToSteady

    default:
      // eslint-disable-next-line no-unused-expressions
      ;(saveState: empty)
  }

  throw new Error('Unexpected state')
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
    this.state = {saving: false, savingChanged: 0, saveState: 'steady', saveStateChanged: 0}
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    if (nextProps.saving === prevState.saving) {
      return null
    }

    return {saving: nextProps.saving, savingChanged: Date.now()}
  }

  _runStateMachine = () => {
    if (this._timeoutID) {
      clearTimeout(this._timeoutID)
      this._timeoutID = null
    }

    const now = Date.now()
    const result = computeNextState(this.props, this.state, now)
    if (!result) {
      return
    }

    if (typeof result === 'number') {
      this._timeoutID = setTimeout(this._runStateMachine, result)
      return
    }

    this.setState({saveState: result, saveStateChanged: now})
  }

  componentDidUpdate = () => {
    this._runStateMachine()
  }

  render = () => {
    const {saveState} = this.state
    switch (saveState) {
      case 'steady':
        return null

      case 'saving':
      case 'savingHysteresis':
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

      default:
        // eslint-disable-next-line no-unused-expressions
        ;(saveState: empty)
    }
  }
}

export type {SaveState}
export default SaveIndicator
