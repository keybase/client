import * as React from 'react'
import {formatDuration} from '../../util/timestamp'

export type UploadCountdownHOCProps = {
  endEstimate?: number
  files: number
  fileName: string | null
  isOnline: boolean
  totalSyncingBytes: number
  debugToggleShow?: () => void
  smallMode?: boolean
}

// Cosider this component as a state machine with following four states. 1Hz
// Ticks (from tick() calls by setInterval) and props changes (through
// componentDidUpdate() calls) are two possible inputs.
export enum Mode {
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

const tickInterval = 1000
const initialGlueTTL = 2

export const useUploadCountdown = (p: UploadCountdownHOCProps) => {
  const {endEstimate, files, fileName, isOnline, totalSyncingBytes, debugToggleShow, smallMode} = p
  const tickerID = React.useRef<ReturnType<typeof setInterval>>()

  const [displayDuration, setDisplayDuration] = React.useState(0)
  const [glueTTL, setGlueTTL] = React.useState(0)
  const [mode, setMode] = React.useState(Mode.Hidden)
  const [now, setNow] = React.useState(Date.now())

  const tick = React.useCallback(() => {
    setNow(Date.now())
  }, [])

  // Idempotently start the ticker. If the ticker has already been started,
  // this is a no-op.
  const startTicker = React.useCallback(() => {
    if (tickerID.current) {
      return
    }
    tickerID.current = setInterval(tick, tickInterval)
  }, [tick])

  // Idempotently stop the ticker. If the ticker is not running, this is a
  // no-op.
  const stopTicker = React.useCallback(() => {
    if (!tickerID.current) {
      return
    }
    clearInterval(tickerID.current)
    tickerID.current = undefined
  }, [])

  React.useEffect(() => {
    return () => {
      stopTicker()
    }
  }, [stopTicker])

  React.useEffect(() => {
    const isUploading = isOnline && (!!files || !!totalSyncingBytes)
    const newDisplayDuration = endEstimate ? endEstimate - now : 0
    switch (mode) {
      case Mode.Hidden:
        if (isUploading) {
          startTicker()
          setDisplayDuration(newDisplayDuration)
          setGlueTTL(initialGlueTTL)
          setMode(Mode.CountDown)
        } else {
          stopTicker()
        }
        return
      case Mode.CountDown:
        if (isUploading) {
          setDisplayDuration(newDisplayDuration)
        } else {
          setDisplayDuration(newDisplayDuration)
          setMode(glueTTL > 0 ? Mode.Sticky : Mode.Hidden)
        }
        return
      case Mode.Sticky:
        if (isUploading) {
          setDisplayDuration(newDisplayDuration)
          setGlueTTL(initialGlueTTL)
          setMode(Mode.CountDown)
        } else {
          setDisplayDuration(newDisplayDuration)
          if (newDisplayDuration === 0) {
            const newGlueTTL = Math.max(0, glueTTL - 1)
            if (newGlueTTL > 0) {
              setGlueTTL(newGlueTTL)
            } else {
              setMode(Mode.Hidden)
            }
          }
        }
        return
      default:
        return
    }
  }, [isOnline, files, totalSyncingBytes, endEstimate, glueTTL, mode, startTicker, now, stopTicker])

  return {
    debugToggleShow,
    fileName,
    files,
    showing: mode !== Mode.Hidden,
    smallMode,
    timeLeft: formatDuration(displayDuration),
    totalSyncingBytes,
  }
}
