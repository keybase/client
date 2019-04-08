import * as React from 'react'
import Box from './box'
import HOCTimers, { PropsWithTimer } from './hoc-timers';
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import * as Flow from '../util/flow'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  StylesCrossPlatform,
} from '../styles';

type SaveState = "steady" | "saving" | "savingHysteresis" | "justSaved";

type _Props = {
  saving: boolean,
  style?: StylesCrossPlatform,
  minSavingTimeMs: number,
  savedTimeoutMs: number,
  debugLog?: (arg0: string) => void
};

type Props = PropsWithTimer<_Props>;

type State = {
  saving: boolean,
  lastSave: Date,
  saveState: SaveState,
  lastJustSaved: Date
};

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

    case 'savingHysteresis':
      if (state.saving) {
        return 'saving'
      }

      const timeToJustSaved = state.lastSave.getTime() + props.minSavingTimeMs - now.getTime()
      if (timeToJustSaved > 0) {
        return timeToJustSaved
      }

      return 'justSaved'

    case 'justSaved':
      if (state.saving) {
        return 'saving'
      }

      const timeToSteady = state.lastJustSaved.getTime() + props.savedTimeoutMs - now.getTime()
      if (timeToSteady > 0) {
        return timeToSteady
      }

      return 'steady'

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
  _timeoutID: number | null;

  constructor(props: Props) {
    super(props)
    this.state = {lastJustSaved: new Date(0), lastSave: new Date(0), saveState: 'steady', saving: false}
  }

  _runStateMachine = () => {
    if (this._timeoutID) {
      this.props.clearTimeout(this._timeoutID)
    }
    this._timeoutID = null

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
    const newPartialState = {saveState: result, ...(result === 'justSaved' ? {lastJustSaved: now} : {})}
    if (debugLog) {
      debugLog(
        `_runStateMachine: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(this.state)}`
      )
    }
    this.setState(newPartialState)
  }

  componentDidUpdate = (prevProps: Props, prevState: State) => {
    if (this.props.saving !== this.state.saving) {
      const debugLog = this.props.debugLog
      const newPartialState = {
        saving: this.props.saving,
        ...(this.props.saving ? {lastSave: new Date()} : {}),
      }
      if (debugLog) {
        debugLog(
          `componentDidUpdate: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(prevState)}`
        )
      }
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
            <Text type="BodySmall" style={{color: globalColors.green}}>
              &nbsp; Saved
            </Text>
          </React.Fragment>
        )

      default:
        declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: never) => any;
        ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(saveState);
        throw new Error(`Unexpected state ${saveState}`)
    }
  }

  render = () => {
    return <Box style={collapseStyles([defaultStyle, this.props.style])}>{this._getChildren()}</Box>
  }
}

export { _Props, Props, State };
export {computeNextState}
export default HOCTimers(SaveIndicator)
