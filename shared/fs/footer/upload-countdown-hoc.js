// @flow
import * as React from 'react'
import {compose} from '../../util/container'
import {formatDuration} from '../../util/timestamp'
import {HOCTimers, type PropsWithTimer} from '../../common-adapters'
import {type UploadProps} from './upload'

export type UploadCountdownHOCProps = {
  endEstimate?: number,
  files: number,
  filePaths: string,
  totalSyncingBytes: number,
  debugToggleShow?: () => void,
}

type Props = PropsWithTimer<UploadCountdownHOCProps>

// Cosider this component as a state machine with following four states. 1Hz
// Ticks (from _tick() calls by setInterval) and props changes (through
// componentDidUpdate() calls) are two possible inputs.
type Mode =
  // The upload banner isn't shown.
  | 'hidden'
  // Normal count-down. If upload is finished during this state while glueTTL
  // is smaller than or equal to 0, transition to hidden. If upload is finished
  // during this state while glueTTL is greater than 0, transition to sticky.
  | 'count-down'
  // The upload banner should have been hidden but we are still showing it
  // because it hasn't been showed for long enough. When glueTTL hits 0,
  // transition to 0.
  | 'sticky'

type State = {
  displayDuration: number,
  mode: Mode,
  glueTTL: number,
}

const tickInterval = 1000
const initialGlueTTL = 2

const UploadCountdownHOC = (Upload: React.ComponentType<UploadProps>) =>
  class extends React.PureComponent<Props, State> {
    state = {
      displayDuration: 0,
      mode: 'hidden',
      glueTTL: 0,
    }

    _tickerID: ?IntervalID = null

    _tick = () =>
      this.setState(prevState => {
        const {mode, glueTTL, displayDuration} = prevState
        const newDisplayDuration = displayDuration > 1000 ? displayDuration - 1000 : 0
        const newGlueTTL = glueTTL > 1 ? glueTTL - 1 : 0
        switch (mode) {
          case 'hidden':
            this._stopTicker()
            return {}
          case 'count-down':
            return {
              displayDuration: newDisplayDuration,
              glueTTL: newGlueTTL,
            }
          case 'sticky':
            return {
              mode: newGlueTTL > 0 ? 'sticky' : 'hidden',
              glueTTL: newGlueTTL,
              displayDuration: newDisplayDuration,
            }
          default:
            /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (mode: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(mode);
      */
            return {}
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
      this._tickerID = null
    }

    componentDidUpdate(prevProps) {
      if (this.props.files === prevProps.files && this.props.endEstimate === prevProps.endEstimate) {
        return
      }
      this.setState((prevState, props) => {
        const isUploading = !!props.files || !!props.totalSyncingBytes
        const displayDuration = props.endEstimate ? props.endEstimate - Date.now() : 0
        const {mode, glueTTL} = prevState
        switch (mode) {
          case 'hidden':
            if (isUploading) {
              this._startTicker()
              return {
                mode: 'count-down',
                glueTTL: initialGlueTTL,
                displayDuration,
              }
            }
            return {}
          case 'count-down':
            if (isUploading) {
              return {
                displayDuration,
              }
            }
            return {
              mode: glueTTL > 0 ? 'sticky' : 'hidden',
              displayDuration,
            }
          case 'sticky':
            return isUploading
              ? {
                  mode: 'count-down',
                  displayDuration,
                  glueTTL: initialGlueTTL,
                }
              : {
                  displayDuration,
                }
          default:
            /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (mode: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(mode);
      */
            return {}
        }
      })
    }

    render() {
      const {files, filePaths, totalSyncingBytes, debugToggleShow} = this.props
      const {displayDuration, mode} = this.state
      return (
        <Upload
          showing={mode !== 'hidden'}
          files={files}
          filePaths={filePaths}
          totalSyncingBytes={totalSyncingBytes}
          timeLeft={formatDuration(displayDuration)}
          debugToggleShow={debugToggleShow}
        />
      )
    }
  }

export default compose(HOCTimers, UploadCountdownHOC)
