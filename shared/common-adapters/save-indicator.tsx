import * as React from 'react'
import Box from './box'
import HOCTimers, {PropsWithTimer} from './hoc-timers'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import * as Flow from '../util/flow'
import {collapseStyles, globalColors, globalMargins, globalStyles, StylesCrossPlatform} from '../styles'

// States of the state machine for the save indicator:
//
//   steady:           (initial state) Nothing's been saved yet, or enough time
//                     has passed since the last save. Display nothing.
//   saving:           In the middle of saving; display a progress indicator.
//   savingHysteresis: Just finished saving, but still display a
//                     progress indicator until some minimum time has
//                     elapsed.
//   justSaved:        Just finished saving; display a checkbox and 'Saved' for some minimum time.
//
// The possible transitions are (implemented in computeNextState):
//
//   * -> saving:                   whenever Props.saving goes from true to false.
//   saving -> savingHysteresis:    whenever Props.saving goes from false to true.
//   savingHysteresis -> justSaved: whenever at least minSavingTimeMs
//                                  has elapsed in the
//                                  saving/savingHysteresis state.
//   justSaved -> steady:           whenever at least savedTimeoutMs has elapsed
//                                  in the justSaved state.
type SaveState = 'steady' | 'saving' | 'savingHysteresis' | 'justSaved'

export type _Props = {
  saving: boolean
  style?: StylesCrossPlatform
  // Minimum duration to stay in saving or savingHysteresis.
  minSavingTimeMs: number
  // Minimum duration to stay in justSaved.
  savedTimeoutMs: number
  debugLog?: (arg0: string) => void
}

export type Props = PropsWithTimer<_Props>

export type State = {
  // Mirrors Props.saving.
  saving: boolean
  // Last time saving went from false to true.
  lastSave: Date
  saveState: SaveState
  // Last time saveState was set to 'justSaved'.
  lastJustSaved: Date
}

// computeNextState takes props and state, possibly with updated
// saving / lastSave fields, the current time, and returns either:
//
// - null:      Remain in the current state.
// - SaveState: Transition to the returned state.
// - number:    Wait the returned number of ms, then run computeNextState again.
const computeNextState = (props: _Props, state: State, now: Date): null | SaveState | number => {
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

    case 'savingHysteresis': {
      if (state.saving) {
        return 'saving'
      }

      const timeToJustSaved = state.lastSave.getTime() + props.minSavingTimeMs - now.getTime()
      if (timeToJustSaved > 0) {
        return timeToJustSaved
      }

      return 'justSaved'
    }

    case 'justSaved': {
      if (state.saving) {
        return 'saving'
      }

      const timeToSteady = state.lastJustSaved.getTime() + props.savedTimeoutMs - now.getTime()
      if (timeToSteady > 0) {
        return timeToSteady
      }

      return 'steady'
    }

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(saveState)
      throw new Error(`Unexpected state ${saveState}`)
  }
}

const defaultStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: globalMargins.medium,
  justifyContent: 'center',
}

class SaveIndicator extends React.Component<Props, State> {
  _timeoutID?: NodeJS.Timeout

  constructor(props: Props) {
    super(props)
    this.state = {lastJustSaved: new Date(0), lastSave: new Date(0), saveState: 'steady', saving: false}
  }

  _runStateMachine = () => {
    if (this._timeoutID) {
      this.props.clearTimeout(this._timeoutID)
    }
    this._timeoutID = undefined

    const now = new Date()
    const result = computeNextState(this.props, this.state, now)
    if (!result) {
      return
    }

    if (typeof result === 'number') {
      this._timeoutID = this.props.setTimeout(this._runStateMachine, result)
      return
    }

    const debugLog = this.props.debugLog
    const newPartialState: Partial<State> = {
      saveState: result,
      ...(result === 'justSaved' ? {lastJustSaved: now} : {}),
    }
    if (debugLog) {
      debugLog(
        `_runStateMachine: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(this.state)}`
      )
    }
    // @ts-ignore problem in react type def. This is protected by the type assertion of : Partial<State> above
    this.setState(newPartialState)
  }

  componentDidUpdate = (_: Props, prevState: State) => {
    if (this.props.saving !== this.state.saving) {
      const debugLog = this.props.debugLog
      const newPartialState: Partial<State> = {
        saving: this.props.saving,
        ...(this.props.saving ? {lastSave: new Date()} : {}),
      }
      if (debugLog) {
        debugLog(
          `componentDidUpdate: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(prevState)}`
        )
      }
      // @ts-ignore problem in react type def. This is protected by the type assertion of : Partial<State> above
      this.setState(newPartialState)
    }

    this._runStateMachine()
  }

  _getChildren = () => {
    const {saveState} = this.state
    switch (saveState) {
      case 'steady':
        return null
      case 'saving':
      case 'savingHysteresis':
        return <ProgressIndicator style={{width: globalMargins.medium}} />
      case 'justSaved':
        return (
          <React.Fragment>
            <Icon type="iconfont-check" color={globalColors.green} />
            <Text type="BodySmall" style={{color: globalColors.greenDark}}>
              &nbsp; Saved
            </Text>
          </React.Fragment>
        )
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(saveState)
        throw new Error(`Unexpected state ${saveState}`)
    }
  }

  render = () => {
    return <Box style={collapseStyles([defaultStyle, this.props.style])}>{this._getChildren()}</Box>
  }
}

export {computeNextState}
export default HOCTimers(SaveIndicator)
