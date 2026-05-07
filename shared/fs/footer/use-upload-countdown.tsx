import * as React from 'react'
import {formatDuration} from '@/util/timestamp'

export type UploadCountdownHOCProps = {
  endEstimate?: number
  files: number
  fileName?: string
  isOnline: boolean
  totalSyncingBytes: number
  debugToggleShow?: () => void
  smallMode?: boolean
}

// Cosider this component as a state machine with following four states. 1Hz
// Ticks (from tick() calls by setInterval) and props changes (through
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

const tickInterval = 1000
const initialGlueTTL = 2

type UploadCountdownState = {
  glueTTL: number
  inputKey: string
  mode: Mode
}

const makeInputKey = (isOnline: boolean, files: number, totalSyncingBytes: number, endEstimate: number) =>
  `${isOnline}:${files}:${totalSyncingBytes}:${endEstimate}`

const updateCountdownState = (
  state: UploadCountdownState,
  isUploading: boolean,
  displayDuration: number,
  inputKey: string,
  isTick = false
): UploadCountdownState => {
  if (state.inputKey === inputKey && !isTick) {
    return state
  }
  switch (state.mode) {
    case Mode.Hidden:
      if (isUploading) {
        return {glueTTL: initialGlueTTL, inputKey, mode: Mode.CountDown}
      }
      return state.inputKey === inputKey ? state : {...state, inputKey}
    case Mode.CountDown:
      if (isUploading) {
        return state.inputKey === inputKey ? state : {...state, inputKey}
      }
      return {glueTTL: state.glueTTL, inputKey, mode: state.glueTTL > 0 ? Mode.Sticky : Mode.Hidden}
    case Mode.Sticky: {
      if (isUploading) {
        return {glueTTL: initialGlueTTL, inputKey, mode: Mode.CountDown}
      }
      if (displayDuration !== 0) {
        return state.inputKey === inputKey ? state : {...state, inputKey}
      }
      if (!isTick) {
        return state.inputKey === inputKey ? state : {...state, inputKey}
      }
      const glueTTL = Math.max(0, state.glueTTL - 1)
      return glueTTL > 0 ? {glueTTL, inputKey, mode: Mode.Sticky} : {glueTTL, inputKey, mode: Mode.Hidden}
    }
  }
}

export const useUploadCountdown = (p: UploadCountdownHOCProps) => {
  const {endEstimate, files, fileName, isOnline, totalSyncingBytes, debugToggleShow, smallMode} = p

  const [now, setNow] = React.useState(() => Date.now())
  const displayDuration = endEstimate ? endEstimate - now : 0
  const isUploading = isOnline && (!!files || !!totalSyncingBytes)
  const inputKey = makeInputKey(isOnline, files, totalSyncingBytes, endEstimate || 0)
  const [countdownState, setCountdownState] = React.useState<UploadCountdownState>(() =>
    updateCountdownState({glueTTL: 0, inputKey: '', mode: Mode.Hidden}, isUploading, displayDuration, inputKey)
  )
  const visibleCountdownState = updateCountdownState(countdownState, isUploading, displayDuration, inputKey)
  if (visibleCountdownState !== countdownState) {
    setCountdownState(visibleCountdownState)
  }

  React.useEffect(() => {
    if (visibleCountdownState.mode === Mode.Hidden) {
      return
    }
    const tickerID = setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)
      setCountdownState(state =>
        updateCountdownState(state, isUploading, endEstimate ? endEstimate - nextNow : 0, inputKey, true)
      )
    }, tickInterval)
    return () => {
      clearInterval(tickerID)
    }
  }, [endEstimate, inputKey, isUploading, visibleCountdownState.mode])

  return {
    debugToggleShow,
    fileName,
    files,
    showing: visibleCountdownState.mode !== Mode.Hidden,
    smallMode,
    timeLeft: formatDuration(displayDuration),
    totalSyncingBytes,
  }
}
