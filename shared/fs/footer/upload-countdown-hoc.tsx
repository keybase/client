import * as Flow from '../../util/flow'
import * as React from 'react'
import {formatDuration} from '../../util/timestamp'
import {HOCTimers, PropsWithTimer} from '../../common-adapters'
import {UploadProps} from './upload'

export type UploadCountdownHOCProps = {
  endEstimate?: number
  files: number
  fileName: string | null
  isOnline: boolean
  totalSyncingBytes: number
  debugToggleShow?: () => void
}

type Props = PropsWithTimer<UploadCountdownHOCProps>

// Cosider this component as a state machine with following four states. 1Hz
// Ticks (from _tick() calls by setInterval) and props changes (through
// componentDidUpdate() calls) are two possible inputs.
enum Mode {
  // The upload banner isn't shown.
  Hidden,
  // Normal count-down. If upload is finished during this state while glueTTL
  // is smaller than or equal to 0, transition to hidden. If upload is finished
  // during this state while glueTTL is greater than 0, transition to sticky.
  CountDown,
  // The upload banner should have been hidden but we are still showing it
  // because it hasn't been showed for long enough. When glueTTL hits 0,
  // transition to 0.
  Sticky,
}

type State = {
  displayDuration: number
  mode: Mode
  glueTTL: number
}

const tickInterval = 1000
const initialGlueTTL = 2
const initState = {
  displayDuration: 0,
  glueTTL: 0,
  mode: Mode.Hidden,
}

const UploadCountdownHOC = (Upload: React.ComponentType<UploadProps>) =>
  class extends React.PureComponent<Props, State> {
    _tickerID?: NodeJS.Timeout

    _tick = () =>
      this.setState(prevState => {
        const {mode, glueTTL, displayDuration} = prevState
        const newDisplayDuration = displayDuration > 1000 ? displayDuration - 1000 : 0
        const newGlueTTL = glueTTL > 1 ? glueTTL - 1 : 0
        switch (mode) {
          case Mode.Hidden:
            this._stopTicker()
            return null
          case Mode.CountDown:
            return {
              displayDuration: newDisplayDuration,
              glueTTL: newGlueTTL,
              mode,
            }
          case Mode.Sticky:
            return {
              displayDuration: newDisplayDuration,
              glueTTL: newGlueTTL,
              mode: newGlueTTL > 0 ? Mode.Sticky : Mode.Hidden,
            }
          default:
            Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(mode)
            return null
        }
      })

    // Idempotently start the ticker. If the ticker has already been started,
    // this is a no-op.
    _startTicker = () => {
      if (this._tickerID) {
        return
      }
      this._tickerID = this.props.setInterval(this._tick, tickInterval)
    }

    // Idempotently stop the ticker. If the ticker is not running, this is a
    // no-op.
    _stopTicker = () => {
      if (!this._tickerID) {
        return
      }
      this.props.clearInterval(this._tickerID)
      this._tickerID = undefined
    }

    _updateState = (prevState: Readonly<State>, props: Readonly<Props>) => {
      const isUploading = props.isOnline && (!!props.files || !!props.totalSyncingBytes)
      const newDisplayDuration = props.endEstimate ? props.endEstimate - Date.now() : 0
      const {mode, glueTTL} = prevState
      switch (mode) {
        case Mode.Hidden:
          if (isUploading) {
            this._startTicker()
            return {
              displayDuration: newDisplayDuration,
              glueTTL: initialGlueTTL,
              mode: Mode.CountDown,
            }
          }
          return null
        case Mode.CountDown:
          if (isUploading) {
            return {
              displayDuration: newDisplayDuration,
              glueTTL,
              mode,
            }
          }
          return {
            displayDuration: newDisplayDuration,
            glueTTL,
            mode: glueTTL > 0 ? Mode.Sticky : Mode.Hidden,
          }
        case Mode.Sticky:
          return isUploading
            ? {
                displayDuration: newDisplayDuration,
                glueTTL: initialGlueTTL,
                mode: Mode.CountDown,
              }
            : {
                displayDuration: newDisplayDuration,
                glueTTL,
                mode,
              }
        default:
          Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(mode)
          return null
      }
    }

    state = {...initState, ...this._updateState(initState, this.props)}

    componentDidUpdate(prevProps: Props) {
      if (
        this.props.isOnline === prevProps.isOnline &&
        this.props.files === prevProps.files &&
        this.props.totalSyncingBytes === prevProps.totalSyncingBytes &&
        this.props.endEstimate === prevProps.endEstimate
      ) {
        return
      }
      this.setState(this._updateState)
    }

    render() {
      const {files, fileName, totalSyncingBytes, debugToggleShow} = this.props
      const {displayDuration, mode} = this.state
      return (
        <Upload
          showing={mode !== Mode.Hidden}
          files={files}
          fileName={fileName}
          totalSyncingBytes={totalSyncingBytes}
          timeLeft={formatDuration(displayDuration)}
          debugToggleShow={debugToggleShow}
        />
      )
    }
  }

export default (ComposedComponent: React.ComponentType<any>) =>
  HOCTimers(UploadCountdownHOC(ComposedComponent))
