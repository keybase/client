// @flow
import * as React from 'react'
import Box from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

type SaveState = 'steady' | 'saving' | 'savingHysteresis' | 'justSaved'

type Props = {
  saving: boolean,
  minSavingTimeMs: number,
  savedTimeoutMs: number,
  onStateChange?: string => void,
}

type State = {
  saving: boolean,
  lastSave: Date,
  saveState: SaveState,
  lastJustSaved: Date,
}

const computeNextState = (props: Props, state: State, now: Date): null | SaveState | number => {
  const {saveState} = state
  switch (saveState) {
    case 'steady':
      if (state.saving) {
        return 'saving'
      }

      return null

    case 'saving':
      if (state.saving) {
        return null
      }

      return 'savingHysteresis'

    case 'savingHysteresis':
      if (state.saving) {
        return 'saving'
      }

      const timeSinceLastSave = now - state.lastSave
      const timeToJustSaved = props.minSavingTimeMs - timeSinceLastSave
      if (timeToJustSaved > 0) {
        return timeToJustSaved
      }

      return 'justSaved'

    case 'justSaved':
      if (state.saving) {
        return 'saving'
      }

      const timeSinceJustSaved = now - state.lastJustSaved
      const timeToSteady = props.savedTimeoutMs - timeSinceJustSaved
      if (timeToSteady > 0) {
        return timeToSteady
      }

      return 'steady'

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
    this.state = {saving: false, lastSave: new Date(0), saveState: 'steady', lastJustSaved: new Date(0)}
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    if (nextProps.saving === prevState.saving) {
      return null
    }

    const onStateChange = nextProps.onStateChange
    const newPartialState = {saving: nextProps.saving, ...(nextProps.saving ? {lastSave: new Date()} : {})}
    if (onStateChange) {
      onStateChange(`merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(prevState)}`)
    }
    return newPartialState
  }

  _runStateMachine = () => {
    if (this._timeoutID) {
      clearTimeout(this._timeoutID)
      this._timeoutID = null
    }

    const now = new Date()
    const result = computeNextState(this.props, this.state, now)
    if (!result) {
      return
    }

    if (typeof result === 'number') {
      this._timeoutID = setTimeout(this._runStateMachine, result)
      return
    }

    const onStateChange = this.props.onStateChange
    const newPartialState = {saveState: result, ...(result === 'justSaved' ? {lastJustSaved: now} : {})}
    if (onStateChange) {
      onStateChange(`merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(this.state)}`)
    }
    this.setState(newPartialState)
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

export type {Props, State}
export {computeNextState}
export default SaveIndicator
